const HUFS_MENU_ENDPOINT = 'https://www.hufs.ac.kr/cafeteria/hufs/2/getMenu';
const SOURCE_NAME = 'google-apps-script';
const SCRIPT_TIMEZONE = 'Asia/Seoul';

const CAFETERIAS = [
  { id: 'h203', name: '한그릇 식당' },
  { id: 'h202', name: '외대 한상 식당' },
  { id: 'h205', name: 'HufsDorm 식당' },
];

function myFunction() {
  return crawlThisWeekMenus();
}

function crawlThisWeekMenus() {
  return crawlMenusForDate(new Date());
}

function crawlMenusForDate(date) {
  const payload = buildCrawlerPayloadForWeek(date || new Date());
  Logger.log('Collected %s HUFS cafeteria menu items.', payload.menus.length);
  return sendMenusToBackend(payload);
}

function buildCrawlerPayloadForWeek(date) {
  const weekRange = getKstWeekRange(date || new Date());
  const segments = splitRangeByMonth(weekRange.start, weekRange.end);
  const menus = [];

  CAFETERIAS.forEach(function(cafeteria) {
    segments.forEach(function(segment) {
      const html = fetchHufsMenuHtml(cafeteria.id, segment);
      const parsedMenus = parseHufsMenuHtml(html, cafeteria.name);

      parsedMenus.forEach(function(menu) {
        const menuDate = parseDateStringToUtc(menu.date);
        if (menuDate >= weekRange.start && menuDate <= weekRange.end) {
          menus.push(menu);
        }
      });
    });
  });

  if (menus.length === 0) {
    throw new Error('No HUFS cafeteria menus were collected for the selected week.');
  }

  return {
    source: SOURCE_NAME,
    crawledAt: new Date().toISOString(),
    menus: menus,
  };
}

function sendMenusToBackend(payload) {
  const properties = PropertiesService.getScriptProperties();
  const baseUrl = trimTrailingSlash(properties.getProperty('BACKEND_BASE_URL'));
  const apiKey = properties.getProperty('CRAWLER_API_KEY');

  if (!baseUrl) {
    throw new Error('Missing Script Property: BACKEND_BASE_URL');
  }

  if (!apiKey) {
    throw new Error('Missing Script Property: CRAWLER_API_KEY');
  }

  const response = UrlFetchApp.fetch(baseUrl + '/crawler/menus', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Crawler-Api-Key': apiKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText('UTF-8');

  Logger.log('Backend response: HTTP %s %s', statusCode, body);

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Backend menu ingestion failed: HTTP ' + statusCode + ' ' + body);
  }

  return JSON.parse(body || '{}');
}

function fetchHufsMenuHtml(cafeteriaId, segment) {
  const response = UrlFetchApp.fetch(HUFS_MENU_ENDPOINT, {
    method: 'post',
    payload: {
      selCafId: cafeteriaId,
      selWeekFirstDay: String(segment.firstDay),
      selWeekLastDay: String(segment.lastDay),
      selYear: String(segment.year),
      selMonth: pad2(segment.month),
    },
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText('UTF-8');

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      'HUFS menu request failed for cafeteria ' +
        cafeteriaId +
        ': HTTP ' +
        statusCode +
        ' ' +
        body
    );
  }

  return body;
}

function parseHufsMenuHtml(html, cafeteriaName) {
  const dates = extractTableDates(html);
  const tbody = firstMatch(html, /<tbody[^>]*>([\s\S]*?)<\/tbody>/i);

  if (!dates.length || !tbody) {
    Logger.log('No parsable HUFS menu table found for %s.', cafeteriaName);
    return [];
  }

  const menus = [];
  const rows = matchAll(tbody, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);

  rows.forEach(function(rowHtml) {
    const title = normalizeText(stripTags(firstMatch(rowHtml, /<th[^>]*>([\s\S]*?)<\/th>/i)));
    if (!title) {
      return;
    }

    const cells = matchAll(rowHtml, /<td\b([^>]*)>([\s\S]*?)<\/td>/gi);

    cells.forEach(function(match, index) {
      const cellClass = getClassAttribute(match[1]);
      const cellHtml = match[2];
      const date = dates[index];

      if (!date || hasClass(cellClass, 'no-menu') || !hasClass(cellClass, 'menu')) {
        return;
      }

      const rawMenuText = extractMenuText(cellHtml);
      if (!rawMenuText) {
        return;
      }

      if (isOperationalNoticeOnly(rawMenuText)) {
        return;
      }

      menus.push({
        cafeteriaName: cafeteriaName,
        date: date,
        mealType: getMealType(title),
        title: title,
        rawMenuText: rawMenuText,
      });
    });
  });

  return menus;
}

function extractTableDates(html) {
  return matchAll(html, /<span\b[^>]*id=["']date_(\d{4}-\d{2}-\d{2})["'][^>]*>/gi).map(function(match) {
    return match[1];
  });
}

function extractMenuText(cellHtml) {
  return matchAll(cellHtml, /<li[^>]*>([\s\S]*?)<\/li>/gi)
    .map(function(match) {
      return normalizeText(stripTags(match[1]));
    })
    .filter(function(text) {
      return text.length > 0;
    })
    .join('\n');
}

function getMealType(title) {
  if (title.indexOf('조식') !== -1) {
    return 'breakfast';
  }

  if (title.indexOf('중식') !== -1 || title.indexOf('일품') !== -1 || title.indexOf('뚝배기') !== -1) {
    return 'lunch';
  }

  if (title.indexOf('석식') !== -1) {
    return 'dinner';
  }

  const startHour = extractStartHour(title);
  if (startHour !== null) {
    if (startHour >= 5 && startHour < 10) {
      return 'breakfast';
    }

    if (startHour >= 10 && startHour < 16) {
      return 'lunch';
    }

    if (startHour >= 16 && startHour < 22) {
      return 'dinner';
    }
  }

  return 'other';
}

function extractStartHour(title) {
  const match = /\((\d{1,2}):\d{2}\s*~/.exec(title);
  return match ? Number(match[1]) : null;
}

function isOperationalNoticeOnly(rawMenuText) {
  const compactText = String(rawMenuText || '').replace(/\s+/g, '');

  return (
    compactText === '이전운영' ||
    compactText === '운영없음' ||
    compactText === '미운영' ||
    compactText === '휴무' ||
    /^이전운영\(.+\)$/.test(compactText)
  );
}

function getKstWeekRange(date) {
  const base = toKstUtcDate(date);
  const dayOfWeek = base.getUTCDay();
  const start = addUtcDays(base, -dayOfWeek);
  const end = addUtcDays(start, 6);

  return { start: start, end: end };
}

function splitRangeByMonth(start, end) {
  const segments = [];
  let current = start;

  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth() + 1;
    const monthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const segmentEnd = minUtcDate(end, new Date(Date.UTC(year, month - 1, monthLastDay)));

    segments.push({
      year: year,
      month: month,
      firstDay: current.getUTCDate(),
      lastDay: segmentEnd.getUTCDate(),
    });

    current = addUtcDays(segmentEnd, 1);
  }

  return segments;
}

function toKstUtcDate(date) {
  const ymd = Utilities.formatDate(date, SCRIPT_TIMEZONE, 'yyyy-MM-dd');
  return parseDateStringToUtc(ymd);
}

function parseDateStringToUtc(ymd) {
  const parts = ymd.split('-').map(function(value) {
    return Number(value);
  });

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function minUtcDate(a, b) {
  return a <= b ? a : b;
}

function firstMatch(text, regex) {
  const match = regex.exec(text);
  return match ? match[1] : '';
}

function getClassAttribute(attributes) {
  return firstMatch(attributes, /\bclass=["']([^"']*)["']/i);
}

function hasClass(className, targetClass) {
  return String(className || '').split(/\s+/).indexOf(targetClass) !== -1;
}

function matchAll(text, regex) {
  const results = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    results.push(match);
  }

  return results;
}

function stripTags(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function decodeHtmlEntities(text) {
  const namedEntities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };

  return String(text || '')
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, code) {
      return String.fromCharCode(parseInt(code, 16));
    })
    .replace(/&([a-zA-Z]+);/g, function(match, name) {
      return Object.prototype.hasOwnProperty.call(namedEntities, name) ? namedEntities[name] : match;
    });
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}
