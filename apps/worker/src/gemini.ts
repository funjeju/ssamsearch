import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RawSearchResult } from '@ssamsearch/adapters';
import type { SearchResultItem, SiteId } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';
import { logger } from './logger';

const SITE_BASE_URLS: Record<SiteId, string> = {
  indischool: 'https://www.indischool.com',
  iscream: 'https://www.i-scream.co.kr',
  teacherville: 'https://www.teacherville.co.kr',
  tsherpa: 'https://tsherpa.teacher.go.kr',
  edunet: 'https://www.edunet.net',
};

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY']!);
  }
  return genAI;
}

export async function extractWithGemini(
  raw: RawSearchResult,
  context: { siteId: SiteId }
): Promise<SearchResultItem[]> {
  try {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const useFullHtml = raw.rawHtml.length < 10_000;
    const baseUrl = SITE_BASE_URLS[context.siteId];

    const prompt = `당신은 한국 교사용 교육자료 사이트의 검색 결과를 구조화하는 도우미입니다.
사이트: ${context.siteId} (${baseUrl})

다음 데이터에서 자료 항목을 추출하여 JSON으로 반환하세요.
${useFullHtml ? `HTML:\n${raw.rawHtml}` : `후보 목록:\n${JSON.stringify(raw.candidates)}`}

반환 스키마:
{
  "items": [
    {
      "title": "자료 제목",
      "summary": "100자 이내 요약",
      "url": "원문 URL (필수, 절대 경로)",
      "publishedAt": "YYYY-MM-DD 또는 null",
      "author": "작성자 또는 null",
      "grade": "1|2|3|4|5|6|중1|중2|중3|고1|고2|고3 또는 null",
      "subject": "국어|수학|사회|과학|영어|음악|미술|체육|실과|기타 또는 null",
      "materialType": "PPT|학습지|영상|평가지|활동지|지도안|기타",
      "tags": ["관련 키워드 최대 5개"],
      "likeCount": 숫자 또는 null
    }
  ]
}

규칙:
- url이 상대경로면 ${baseUrl} 추가
- 학년·과목·자료유형은 제목과 내용에서 추론
- 추론 불가 시 null
- 광고·공지·이벤트 항목은 제외
- 최대 20개 항목`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as { items: unknown[] };

    return (parsed.items ?? [])
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        source: context.siteId,
        title: String(item['title'] ?? ''),
        summary: String(item['summary'] ?? ''),
        url: String(item['url'] ?? ''),
        publishedAt: item['publishedAt'] ? String(item['publishedAt']) : null,
        author: item['author'] ? String(item['author']) : null,
        grade: item['grade'] ? String(item['grade']) : null,
        subject: item['subject'] ? String(item['subject']) : null,
        materialType: item['materialType'] ? String(item['materialType']) : null,
        tags: Array.isArray(item['tags']) ? (item['tags'] as string[]) : [],
        likeCount: typeof item['likeCount'] === 'number' ? item['likeCount'] : null,
        iconUrl: `/icons/${context.siteId}.svg`,
      }))
      .filter((item) => item.title && item.url);
  } catch (err) {
    logger.warn({ err, siteId: context.siteId }, 'Gemini 파싱 실패, Cheerio 폴백 사용');

    // Fallback: Cheerio 1차 파싱 결과 사용
    return raw.candidates
      .filter((c) => c.title && c.url)
      .map((c) => ({
        source: context.siteId,
        title: c.title,
        summary: c.snippet,
        url: c.url.startsWith('http') ? c.url : `${SITE_BASE_URLS[context.siteId]}${c.url}`,
        publishedAt: c.publishedAt ?? null,
        author: c.author ?? null,
        grade: null,
        subject: null,
        materialType: null,
        tags: [],
        likeCount: c.likeCount ?? null,
        iconUrl: `/icons/${context.siteId}.svg`,
      }));
  }
}
