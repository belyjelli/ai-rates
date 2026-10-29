import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts).
 * Glossary and style: ./index.ts.
 *
 * Terms: Federal Reserve ФРС (a regional Fed ФРБ: ФРБ Атланты, ФРБ Нью-Йорка, ФРБ Чикаго), policy
 * rate ставка ФРС, fed funds rate ставка по федеральным фондам, target range целевой диапазон,
 * midpoint середина (диапазона), effective rate эффективная ставка, interest on reserves ставка по
 * резервам, cut / hike / hold снижение / повышение / без изменений, meeting заседание, expected move
 * ожидаемый шаг, implied подразумеваемая, odds вероятности, middle estimate центральная оценка,
 * balance sheet баланс ФРС, Treasuries трежерис, Treasury (the department) Казначейство, yield
 * доходность, yield curve кривая доходности (инвертирована), real yield реальная доходность,
 * breakeven инфляция безубыточности (breakeven; a bare «breakeven» in labels), core базовый, print
 * публикация, year on year г/г and on the month м/м in labels (за год / за месяц in table heads),
 * annualized годовых in table heads and в годовом выражении elsewhere, payrolls занятость вне с/х
 * (Nonfarm Payrolls), unemployment rate безработица, jobless claims заявки по безработице
 * (initial / continuing первичные / повторные), job openings вакансии, industrial production
 * промпроизводство, retail sales розничные продажи, net liquidity чистая ликвидность, reverse repo
 * обратное репо, stablecoin supply предложение стейблкоинов, Commitments of Traders отчёт COT,
 * leveraged funds фонды с плечом, asset managers управляющие активами, dealers дилеры, managed money
 * управляющие фонды, producers and merchants производители и трейдеры, swap dealers своп-дилеры,
 * percentage points п.п., basis points bps (as the glossary has it). CPI, PCE, FOMC, SEP, SOFR,
 * IORB, JOLTS, NFCI, M2, TIPS, GDPNow, E-mini and the agencies' acronyms stay in Latin letters; GDP
 * is ВВП, as Russian media write it for the US too. A quarter is «3 кв. 2026».
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "Инфляция (CPI)",
  CPI: "CPI",
  "Fed policy": "Политика ФРС",
  Fed: "ФРС",
  Employment: "Занятость",
  Jobs: "Труд",
  Growth: "Экономика",
  "Policy signals": "Сигналы ДКП",
  Signals: "Сигналы",
  "Positioning and flows": "Позиции и потоки",
  Flows: "Потоки",

  // Units, dates and the chart's hints.
  "{n} pp": "{n} п.п.",
  "{n} bp": "{n} bps",
  "{month} {year}": "{month} {year}",
  "Q{q} {year}": "{q} кв. {year}",
  "in {time}": "через {time}",
  "hover or tap the chart to read any point":
    "наведите или нажмите на график, чтобы увидеть значение в любой точке",
  "{chart}; arrow keys read one point at a time": "{chart}; стрелки читают по одной точке",
  "week of {month} {day}, {year}": "неделя с {day} {month} {year}",

  // The release calendar.
  "PCE prices": "Индекс цен PCE",
  "Jobs report": "Отчёт по занятости",
  "Jobless claims": "Заявки по безработице",
  "Job openings (JOLTS)": "Вакансии (JOLTS)",
  GDP: "ВВП",
  "Retail sales": "Розничные продажи",
  "Industrial production": "Промпроизводство",
  "FOMC decision": "Решение FOMC",
  "Coming up": "Ближайшие",

  // Kalshi's ladders and the footnotes.
  "below {value}": "ниже {value}",
  "above {value}": "выше {value}",
  "middle estimate {value}": "центральная оценка {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "Последнее обновление — {ago}: последние чтения этих источников не удались, поэтому данные такой давности.",
  "{sources} Last read {ago}.": "{sources} Прочитано {ago}.",

  // Inflation.
  "No inflation figures have been read yet.": "Данных по инфляции пока нет.",
  "CPI, year on year": "CPI, г/г",
  "{month}: {mom} on the month · core {core}": "{month}: {mom} м/м · базовый {core}",
  "Core PCE, year on year": "Базовый PCE, г/г",
  "{month} · the measure the Fed's 2% target is set in":
    "{month} · показатель, в котором задана цель ФРС 2%",
  "Next CPI": "Следующий CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi: {headline} м/м, базовый {core}",
  "no date published yet": "дата ещё не опубликована",
  "5-year breakeven": "Breakeven 5 лет",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "инфляция, заложенная в трежерис · форвард 5y5y {fwd}",
  "Inflation, year on year": "Инфляция, г/г",
  "Core CPI": "Базовый CPI",
  PCE: "PCE",
  "Core PCE": "Базовый PCE",
  "Fed's 2% target": "Цель ФРС 2%",
  "Inflation the bond market prices in": "Инфляция, заложенная рынком облигаций",
  "10-year breakeven": "Breakeven 10 лет",
  "5y5y forward": "Форвард 5y5y",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "Breakeven — разница между доходностью номинальных трежерис и защищённых от инфляции того же срока. По неделям, последнее закрытие каждой недели.",
  "Latest prints": "Последние публикации",
  Measure: "Показатель",
  Month: "Месяц",
  "On the month": "За месяц",
  "3 months, annualized": "3 мес., годовых",
  "6 months, annualized": "6 мес., годовых",
  "Year on year": "За год",
  "A year earlier": "Год назад",
  "CPI, on the month": "CPI, м/м",
  "Core CPI, on the month": "Базовый CPI, м/м",
  Inflation: "Инфляция",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "CPI — индекс потребительских цен Бюро статистики труда (BLS), выходит ежемесячно; базовый CPI не учитывает продукты питания и энергоносители. PCE — индекс цен личного потребления Бюро экономического анализа (BEA), выходит примерно через две недели после CPI; именно в нём задана цель ФРС в 2%, и базовый PCE — показатель, за которым ФРС следит внимательнее всего.",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "Изменения рассчитываются здесь по сезонно скорректированным индексам: за месяц, за три и шесть месяцев в годовом выражении (недавний темп, который годовой показатель отражает с запозданием) и за год.",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "Инфляция безубыточности (breakeven) — инфляция, заложенная в цены рынка трежерис, по ежедневным доходностям от ФРС: на 5 и 10 лет, а также 5-летняя ставка, которая начинается через пять лет (5y5y) и которую ФРС считает долгосрочными ожиданиями.",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "Kalshi — биржа под надзором CFTC — торгует контрактами, которые выплачивают, если следующая публикация окажется выше заданного уровня. Их цены читаются как вероятности по оценке рынка; центральная оценка — уровень, на котором вероятность «выше» проходит отметку 50%.",
  "What Kalshi's traders expect": "Чего ждут трейдеры Kalshi",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "Источники: BLS и BEA через FRED; breakeven — по доходностям трежерис от ФРС; вероятности — Kalshi.",

  // Fed policy.
  "cut more than 25 bp": "снижение больше чем на 25 bps",
  "cut 25 bp": "снижение на 25 bps",
  hold: "без изменений",
  "hike 25 bp": "повышение на 25 bps",
  "hike more than 25 bp": "повышение больше чем на 25 bps",
  "No Fed policy figures have been read yet.": "Данных по политике ФРС пока нет.",
  "Target range": "Целевой диапазон",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "эффективная {effr} · SOFR {sofr} · ставка по резервам {iorb}",
  "Next FOMC decision": "Следующее решение FOMC",
  "with projections": "с прогнозами",
  "Kalshi: {outcome} {p}": "Kalshi: {outcome} {p}",
  "Rate path the market prices": "Траектория ставки по рынку",
  "midpoint after {meeting}: {move} from today's {mid}":
    "середина после заседания {meeting}: {move} от текущей {mid}",
  "no Kalshi odds read yet": "вероятностей Kalshi пока нет",
  "Fed balance sheet": "Баланс ФРС",
  "{change} over four weeks · week of {date}": "{change} за четыре недели · на {date}",
  "A meeting with a Summary of Economic Projections":
    "Заседание со сводкой экономических прогнозов (SEP)",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "Вероятности по заседаниям (Kalshi)",
  Meeting: "Заседание",
  "Cut &gt;25": "Сниж. &gt;25",
  "Cut 25": "Сниж. 25",
  Hold: "Без изм.",
  "Hike 25": "Повыш. 25",
  "Hike &gt;25": "Повыш. &gt;25",
  "Each outcome's move times its chance, added up":
    "Шаг каждого исхода, умноженный на его вероятность, в сумме",
  "Expected move": "Ожид. шаг",
  "Today's midpoint plus every expected move to this meeting":
    "Текущая середина диапазона плюс все ожидаемые шаги до этого заседания",
  "Implied midpoint": "Подразум. середина",
  "The Fed's own projections": "Прогнозы самой ФРС",
  "Median, end of year": "Медиана, конец года",
  "Longer run": "Долгосрочно",
  "Fed funds rate": "Ставка по федеральным фондам",
  "PCE inflation": "Инфляция PCE",
  "Core PCE inflation": "Базовая инфляция PCE",
  "Unemployment rate": "Безработица",
  "Real GDP growth": "Рост реального ВВП",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "По сводке экономических прогнозов (SEP) от {date}: медиана прогнозов комитета (для ставки — средняя точка точечного графика). Инфляция и рост — IV квартал к IV кварталу; безработица — среднее за IV квартал.",
  "Policy rate": "Ставка ФРС",
  "Top of the range": "Верхняя граница",
  "Bottom of the range": "Нижняя граница",
  "Effective rate": "Эффективная ставка",
  "Fed balance sheet, total assets": "Баланс ФРС, совокупные активы",
  "Total assets": "Совокупные активы",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "Целевой диапазон — диапазон ставки по федеральным фондам, который устанавливает Федеральный комитет по открытым рынкам (FOMC); эффективная ставка — уровень, по которому федеральные фонды фактически торгуются овернайт, SOFR — ставка овернайт по репо с трежерис, а ставка по резервам — то, что ФРС платит банкам; именно она удерживает эффективную ставку внутри диапазона.",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "Вероятности — с Kalshi: для каждого заседания есть контракты, которые выплачивают при снижении более чем на 25 базисных пунктов, снижении на 25 bps, сохранении ставки, повышении на 25 bps или более сильном повышении. Цены по каждому заседанию нормируются так, чтобы в сумме давать 100%. Ожидаемый шаг — размер каждого исхода, умноженный на его вероятность; подразумеваемая середина прибавляет к текущей середине диапазона все ожидаемые шаги — так же CME FedWatch строит траекторию по фьючерсам на федеральные фонды.",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "Прогнозы — собственные прогнозы комитета, выходят четыре раза в год вместе с заявлением по итогам заседания; точечный график (dot plot) — мнение каждого участника о том, где должна быть ставка в конце каждого года.",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "Баланс — совокупные активы ФРС, еженедельно, по состоянию на среду. Он растёт, когда ФРС покупает облигации, и сокращается по мере их погашения.",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "Источники: ФРС и ФРБ Нью-Йорка через FRED; календарь FOMC — ФРС; вероятности — Kalshi.",

  // Employment.
  "No employment figures have been read yet.": "Данных по занятости пока нет.",
  "Payrolls, {month}": "Занятость вне с/х, {month}",
  "jobs added on the month · three-month average {avg}":
    "прирост рабочих мест за месяц · среднее за 3 мес. {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · правило Сам {sahm} (сигнал рецессии от 0.50)",
  "Initial jobless claims": "Первичные заявки по безработице",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "неделя по {date} · среднее за 4 нед. {avg} · повторные {cont}",
  "Next jobs report": "Следующий отчёт по занятости",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi: занятость {pay}, безработица {u}",
  "Jobs added each month": "Прирост рабочих мест по месяцам",
  "Payrolls, change on the month": "Занятость вне с/х, изменение за месяц",
  "Three-month average": "Среднее за 3 месяца",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "Занятость вне с/х (Nonfarm Payrolls), тыс., с сезонной корректировкой. Последние два месяца пересматриваются с каждым отчётом.",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "Правило Сам (Sahm) — средняя безработица за три месяца минус её минимум за предыдущие двенадцать месяцев, в процентных пунктах; каждая рецессия в США с 1970 года начиналась при значении 0.50 и выше. Разрыв — месяц без опроса домохозяйств.",
  "Initial claims": "Первичные заявки",
  "Four-week average": "Среднее за 4 недели",
  "Latest figures": "Последние данные",
  Latest: "Последнее",
  Context: "Контекст",
  "Average hourly earnings": "Средний почасовой заработок",
  "{month}, year on year · {mom} on the month": "{month}, г/г · {mom} м/м",
  "Job openings": "Вакансии",
  "{month} · {before} a year earlier": "{month} · год назад {before}",
  "Continuing claims": "Повторные заявки",
  "week to {date}": "неделя по {date}",
  Payrolls: "Занятость вне с/х",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "Занятость вне с/х (Nonfarm Payrolls) и безработица берутся из ежемесячного отчёта по занятости Бюро статистики труда (BLS), обычно в первую пятницу месяца: занятость — из опроса работодателей, безработица — из опроса домохозяйств. Заявки по безработице — еженедельный подсчёт Министерством труда новых обращений за пособием по безработице, самый оперативный индикатор увольнений.",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "Вакансии — из опроса JOLTS, который отстаёт от отчёта по занятости на месяц. Средний почасовой заработок — оплата труда у частных работодателей, индикатор инфляции зарплат.",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "Вероятности — по контрактам Kalshi на занятость вне с/х и безработицу в следующем отчёте; центральная оценка — уровень, на котором вероятность «выше» проходит отметку 50%.",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "Источники: BLS и Министерство труда через FRED; вероятности — Kalshi.",

  // Growth.
  "No growth figures have been read yet.": "Данных по экономическому росту пока нет.",
  "Real GDP, {quarter}": "Реальный ВВП, {quarter}",
  "on the quarter, annualized · recession probability {p}":
    "за квартал, в годовом выражении · вероятность рецессии {p}",
  "GDPNow, {quarter}": "GDPNow, {quarter}",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "текущая оценка ФРБ Атланты для ещё не опубликованного квартала",
  "Next GDP estimate": "Следующая оценка ВВП",
  "Kalshi: {value} for {quarter}": "Kalshi: {value} за {quarter}",
  "Real GDP growth, annualized": "Рост реального ВВП в годовом выражении",
  "Real GDP": "Реальный ВВП",
  "GDPNow estimate": "Оценка GDPNow",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "Квартал к кварталу в годовом выражении, как публикует Бюро экономического анализа; последнее значение пересматривается дважды.",
  "Activity, year on year": "Активность, г/г",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "Розничные продажи — в долларах, поэтому включают рост цен; промпроизводство — индекс физического объёма.",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "Реальный ВВП — показатель выпуска экономики за вычетом инфляции от Бюро экономического анализа (BEA), квартал к кварталу в годовом выражении. Первая оценка квартала выходит примерно через месяц после его окончания, затем она дважды пересматривается.",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow — модельная оценка ФРБ Атланты для ещё не опубликованного квартала, обновляется по мере выхода данных за каждый месяц; это модель, а не прогноз ФРС.",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "Промпроизводство (индекс ФРС по выпуску обрабатывающей и добывающей промышленности и коммунальных служб) и розничные продажи (данные Бюро переписи) выходят ежемесячно. Вероятность рецессии — по модели Шове и Пигера (Chauvet and Piger) на основе четырёх ежемесячных индикаторов, в том виде, в каком её публикует FRED.",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "Вероятности — по контрактам Kalshi на следующую оценку ВВП.",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "Источники: BEA, ФРС, Бюро переписи и ФРБ Атланты через FRED; вероятности — Kalshi.",

  // Policy signals.
  "No market signals have been read yet.": "Рыночных сигналов пока нет.",
  "2-year yield less fed funds": "2-летняя доходность минус ставка ФРС",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2-летняя {two} выше эффективной ставки: рынок закладывает более высокие ставки на два года вперёд",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2-летняя {two} ниже эффективной ставки: рынок закладывает снижения на два года вперёд",
  "Yield curve, 10-year less 2-year": "Кривая доходности: 10 лет минус 2 года",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10 лет минус 3 мес. {s} · ниже нуля кривая инвертирована",
  "10-year real yield": "Реальная доходность 10 лет",
  "inflation-protected Treasury · nominal 10-year {ten}":
    "трежерис с защитой от инфляции · номинальная 10 лет {ten}",
  "Net liquidity": "Чистая ликвидность",
  "Fed assets less the Treasury's account and reverse repos":
    "активы ФРС минус счёт Казначейства и обратное репо",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "{change} за четыре недели · активы ФРС минус счёт Казначейства и обратное репо",
  "Treasury yields": "Доходность трежерис",
  "3-month": "3 мес.",
  "2-year": "2 года",
  "10-year": "10 лет",
  "30-year": "30 лет",
  "Yield curve": "Кривая доходности",
  "10-year less 2-year": "10 лет минус 2 года",
  "10-year less 3-month": "10 лет минус 3 мес.",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "Инвертированная кривая (длинные доходности ниже коротких) предшествовала каждой рецессии в США с 1970-х, часто за год и более; возврат выше нуля нередко происходил ближе к её началу.",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "Совокупные активы ФРС минус основной счёт Казначейства (TGA) и механизм обратного репо овернайт: грубая оценка долларов, которые баланс ФРС оставляет на рынке; многие криптотрейдеры сопоставляют её с ценами.",
  "Other signals": "Другие сигналы",
  "4 weeks": "4 нед.",
  "1 year": "1 год",
  Reading: "Как читать",
  "Dollar, broad index": "Доллар, широкий индекс",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "индекс доллара ФРС, взвешенный по торговле; укрепление доллара ужесточает условия по всему миру",
  "Financial conditions (NFCI)": "Финансовые условия (NFCI)",
  "below zero: looser than average": "ниже нуля: мягче среднего",
  "above zero: tighter than average": "выше нуля: жёстче среднего",
  "Money supply (M2)": "Денежная масса (M2)",
  "{month}, year on year": "{month}, г/г",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "Что рынок облигаций говорит о политике раньше самой ФРС. Доходность 2-летних трежерис следует за тем, где трейдеры ждут ставку ФРС в ближайшие два года: заметно выше эффективной ставки — ждут повышения; заметно ниже — снижений.",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "Кривая доходности — доходность 10-летних трежерис минус 2-летних, а также минус 3-месячных векселей. Реальная доходность — доходность трежерис с защитой от инфляции (TIPS); высокая реальная доходность — это высокая цена удержания активов, которые ничего не платят, в том числе криптовалют.",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "Чистая ликвидность — баланс ФРС минус деньги Казначейства на счёте в ФРС и остатки по обратному репо, рассчитывается здесь по недельным данным; это эмпирическое правило, а не официальный показатель. NFCI — индекс финансовых условий ФРБ Чикаго, равный нулю на своём долгосрочном среднем.",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "Источники: доходности трежерис, ФРС и ФРБ Чикаго через FRED.",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "Биткоин (CME)",
  "Ether (CME)": "Эфир (CME)",
  "S&P 500 E-mini": "S&P 500 E-mini",
  "Nasdaq-100 E-mini": "Nasdaq-100 E-mini",
  "Russell 2000 E-mini": "Russell 2000 E-mini",
  "VIX futures": "Фьючерсы VIX",
  "2-year Treasury note": "2-летние трежерис",
  "10-year Treasury note": "10-летние трежерис",
  "Treasury bond": "Длинные трежерис (T-Bond)",
  "3-month SOFR": "3-месячная SOFR",
  "30-day fed funds": "30-дневные федеральные фонды",
  "US dollar index": "Индекс доллара США",
  Euro: "Евро",
  "Japanese yen": "Японская иена",
  Gold: "Золото",
  Silver: "Серебро",
  "WTI crude oil": "Нефть WTI",
  Copper: "Медь",

  // Positioning and flows: the tables, tiles and charts.
  "Leveraged funds": "Фонды с плечом",
  "Asset managers": "Управляющие активами",
  Dealers: "Дилеры",
  "Managed money": "Управляющие фонды",
  "Producers and merchants": "Производители и трейдеры",
  "Swap dealers": "Своп-дилеры",
  "Financial futures: who holds them": "Финансовые фьючерсы: кто их держит",
  "Commodity futures: who holds them": "Товарные фьючерсы: кто их держит",
  "{group}, net": "{group}, нетто",
  Week: "За неделю",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "Где нетто этой недели среди всех недель последних трёх лет: 0% — самый глубокий шорт, 100% — самый большой лонг",
  "3-year rank": "Ранг за 3 года",
  "3 years": "3 года",
  "No positioning data has been read yet.": "Данных по позициям пока нет.",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "нетто в контрактах, {share} открытого интереса · ранг за 3 года {rank} · {other} {otherNet}",
  "Stablecoin supply": "Предложение стейблкоинов",
  "{d30} in 30 days · {d90} in 90 days": "{d30} за 30 дней · {d90} за 90 дней",
  "CME Bitcoin, leveraged funds": "Биткоин CME, фонды с плечом",
  "asset managers": "управляющие активами",
  "CME Ether, leveraged funds": "Эфир CME, фонды с плечом",
  "Gold, managed money": "Золото, управляющие фонды",
  producers: "производители",
  "Who holds CME Bitcoin futures": "Кто держит фьючерсы на биткоин CME",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "Нетто-контракты (лонги минус шорты) по пять биткоинов каждый, на каждый вторник. Фонды с плечом — хедж-фонды и трейдинговые компании; большая часть их шорта — фьючерсная нога керри-сделки (cash-and-carry) против спотовых ETF, а не ставка на падение.",
  "Dollar stablecoins in circulation": "Долларовые стейблкоины в обращении",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "Предложение всех стейблкоинов с привязкой к доллару, суммированное DefiLlama: доллары, уже находящиеся в блокчейне, — деньги, которые первыми доходят до цен криптовалют.",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "Кто на самом деле держит фьючерсы — по еженедельному отчёту COT (Commitments of Traders) от CFTC: позиции на вторник, публикация в ближайшую пятницу. Для финансовых фьючерсов CFTC делит трейдеров на дилеров (банки-маркетмейкеры), управляющих активами (пенсионные фонды, страховщики, взаимные фонды: медленные, реальные деньги) и фонды с плечом (хедж-фонды и трейдинговые компании: быстрые, спекулятивные). Для товарных — на производителей и трейдеров (хеджеры), своп-дилеров и управляющие фонды (managed money, спекулянты).",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "Нетто — лонги минус шорты, в контрактах; доля — от открытого интереса рынка. Ранг за 3 года показывает, где нетто этой недели находится среди всех недель последних трёх лет: около 0% спекулянты в самом глубоком шорте за этот период, около 100% — в самом большом лонге; именно тогда позиции обычно начинают разгружаться.",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "Предложение стейблкоинов — доллары, уже находящиеся в блокчейне, по данным DefiLlama: когда оно растёт, в крипту приходят новые деньги.",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "Источники: отчёт COT от CFTC, только фьючерсы{date}; стейблкоины — DefiLlama.",
  ", report of {date}": ", отчёт от {date}",
  "The macro data could not be read right now.": "Макроданные сейчас не удалось прочитать.",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1д",
  "1d change": "За 1 день",
  "7d": "7д",
  "Another Fed hike in 2026": "Ещё одно повышение ставки ФРС в 2026",
  "BTC odds": "BTC шансы",
  "BTC: crowd vs options": "BTC: толпа против опционов",
  "Bitcoin above, {when}": "Биткоин выше, {when}",
  "Bitcoin now": "Биткоин сейчас",
  Chance: "Шанс",
  "Change in the expected move over the last day": "Изменение ожидаемого шага за последний день",
  "Deribit index at the option chain's read": "Индекс Deribit на момент чтения опционов",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Опционы Deribit: Black-76 с наклоном улыбки, между соседними экспирациями",
  "Each FOMC meeting, both venues": "Каждое заседание FOMC, обе площадки",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "Каждая цена — шанс, который трейдеры площадки дают исходу (цена Yes); исходы заседания ФРС приведены к сумме один. Изменения — в процентных пунктах к цене день и неделю назад. Polymarket читается каждые 15 минут и хранится по часам навсегда; шансы Kalshi те же, что во вкладках ФРС, занятость и рост.",
  "Fed cuts in 2026": "Снижения ставки ФРС в 2026",
  "Fed rate at the end of 2026": "Ставка ФРС на конец 2026",
  "GDP growth, the quarter": "Рост ВВП за квартал",
  Gap: "Разница",
  "How high US unemployment goes in 2026": "Насколько вырастет безработица в США в 2026",
  "How high inflation gets in 2026": "Насколько вырастет инфляция в 2026",
  "How many Fed cuts in 2026": "Сколько раз ФРС снизит ставку в 2026",
  "Kalshi median": "Медиана Kalshi",
  "Next settlement": "Следующий расчёт",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "Лестницы по биткоину ещё не прочитаны. Сборщик читает Polymarket каждые 15 минут.",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "Рынки прогнозов ещё не прочитаны. Сборщик читает Polymarket каждые 15 минут.",
  "Percentage points over the last day": "Процентные пункты за последний день",
  "Percentage points over the last week": "Процентные пункты за последнюю неделю",
  "Polymarket less options, in percentage points": "Polymarket минус опционы, в процентных пунктах",
  "Polymarket median": "Медиана Polymarket",
  "Polymarket's change over the last day, in percentage points":
    "Изменение Polymarket за последний день, в процентных пунктах",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.":
    "Лестницы Polymarket рассчитываются по минутному закрытию BTC/USDT на Binance в полдень по Нью-Йорку. Колонка опционов — то, что последняя цепочка BTC на Deribit подразумевает для той же цены и момента: волатильность каждого страйка из улыбки, шанс закрыться выше с учётом наклона улыбки, общая дисперсия между соседними экспирациями. Положительная разница значит, что толпа Polymarket даёт цене больше шансов, чем опционы. «Умные $» — сумма умных кошельков (самых прибыльных по таблице лидеров, как во вкладке рынков прогнозов) на Yes минус их сумма на No.",
  "Polymarket's median outcome": "Медианный исход Polymarket",
  "Prediction markets": "Рынки прогнозов",
  Predictions: "Прогнозы",
  Print: "Показатель",
  Settles: "Расчёт",
  "The Fed rate at the end of 2026": "Ставка ФРС на конец 2026 года",
  "The next prints, both venues": "Следующие публикации, обе площадки",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "Интервал, где накопленные по порядку шансы Polymarket переходят половину",
  "The prediction markets could not be read right now.":
    "Сейчас не удаётся прочитать рынки прогнозов.",
  "The year ahead, on Polymarket": "Год вперёд на Polymarket",
  "US GDP growth in 2026": "Рост ВВП США в 2026",
  "US recession": "Рецессия в США",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "Где лестница шансов «выше X» Kalshi пересекает половину",
  "Widest gap": "Наибольшая разница",
  "above {price} on {date}: the crowd is {side} than the options":
    "выше {price} на {date}: толпа {side}, чем опционы",
  bp: "бп",
  "by the end of each year": "к концу каждого года",
  "crowd median {crowd} · options median {options}":
    "медиана толпы {crowd} · медиана опционов {options}",
  "more bearish": "более медвежья",
  "more bullish": "более бычья",
  "no option chain read yet": "опционы ещё не прочитаны",
  "noon New York": "полдень по Нью-Йорку",
  "{change} pp over a week": "{change} п.п. за неделю",
  "{n} more outcomes under 1%": "ещё {n} исходов ниже 1%",
  "Change in the smart share over the last day, in percentage points":
    "Изменение доли умных денег за день, в процентных пунктах",
  Crowd: "Толпа",
  "Fed, {meeting}": "ФРС, {meeting}",
  No: "Нет",
  Question: "Вопрос",
  "Share of smart $": "Доля умных $",
  "Smart $": "Умные $",
  "Smart money backs": "Умные деньги ставят на",
  "Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.":
    "Умные деньги — это {n} кошельков с наибольшей прибылью в собственной таблице лидеров Polymarket по экономике и крипто за последний месяц или за всё время. Топ-100 держателей каждого исхода читаются ежечасно; меньшие позиции умных кошельков не видны. Когда умные деньги и цена толпы расходятся, одна сторона ошибается, и у умной стороны лучше история.",
  "Smart money on Polymarket": "Умные деньги на Polymarket",
  "That outcome's share of the smart wallets' dollars on the question":
    "Доля этого исхода в деньгах умных кошельков по вопросу",
  "The crowd's price for that outcome": "Цена толпы для этого исхода",
  "The smart wallets' dollars on Yes less their dollars on No":
    "Деньги умных кошельков на Yes минус на No",
  Wallets: "Кошельки",
  Yes: "Да",
  // World indexes tab (web/indexes.ts)
  Country: "Страна",
  "World indexes": "Мировые индексы",
  Indexes: "Индексы",
  India: "Индия",
  Japan: "Япония",
  Korea: "Корея",
  Singapore: "Сингапур",
  Australia: "Австралия",
  Americas: "Америка",
  "Middle East": "Ближний Восток",
  Canada: "Канада",
  Brazil: "Бразилия",
  Mexico: "Мексика",
  Germany: "Германия",
  "United Kingdom": "Великобритания",
  France: "Франция",
  "Euro area": "Еврозона",
  Netherlands: "Нидерланды",
  Spain: "Испания",
  Italy: "Италия",
  Switzerland: "Швейцария",
  Portugal: "Португалия",
  Belgium: "Бельгия",
  Austria: "Австрия",
  Sweden: "Швеция",
  Denmark: "Дания",
  Poland: "Польша",
  Turkey: "Турция",
  Israel: "Израиль",
  "Saudi Arabia": "Саудовская Аравия",
  "Hong Kong": "Гонконг",
  China: "Китай",
  Taiwan: "Тайвань",
  Thailand: "Таиланд",
  Indonesia: "Индонезия",
  Philippines: "Филиппины",
  Malaysia: "Малайзия",
  Vietnam: "Вьетнам",
  Other: "Другое",
  "{n} daily closes, {change}%": "{n} дневных закрытий, {change}%",
  "Its option book on the Gamma Exposure tab": "Его опционная книга на вкладке Gamma Exposure",
  live: "онлайн",
  closing: "закрытие",
  "The index levels could not be read right now.": "Сейчас не удаётся прочитать уровни индексов.",
  "No index level has been read yet. The collector reads them every five minutes.":
    "Уровни индексов ещё не прочитаны. Коллектор читает их каждые пять минут.",
  "Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.":
    "Уровни фондовых индексов Америки, Европы, Ближнего Востока и АТР: изменение за день к предыдущему закрытию, дневной диапазон и месяц дневных закрытий.",
  Index: "Индекс",
  Level: "Уровень",
  Change: "Изменение",
  "Day range": "Дневной диапазон",
  "India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the BSE Sensex, Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close. BSE-100, BSE-200 and BSE-500 have no free source we can read.":
    "Индексы Nifty, Nifty Bank и India VIX — это дневной файл закрытий NSE, читаемый раз в вечер. Остальные читаются каждые пять минут: KOSPI и KOSPI 200 — с Корейской биржи, BSE Sensex, Nikkei 225, TOPIX, Straits Times и S&P/ASX 200 — из котировок Sina, прочие индексы — из котировок с задержкой до 20 минут; у закрывшегося рынка показано его закрытие. Для BSE-100, BSE-200 и BSE-500 нет бесплатного источника, который мы можем читать.",
  // An index's page (web/index-page.ts)
  "No index {ticker}.": "Индекса {ticker} нет.",
  "the Korea Exchange's own index charts, every five minutes":
    "собственные графики индексов Корейской биржи, каждые пять минут",
  "Sina's quote feed, every five minutes": "котировки Sina, каждые пять минут",
  "NSE's daily closing file, read once each evening":
    "дневной файл закрытий NSE, читается раз в вечер",
  "TradingView's quotes, up to 20 minutes behind, every five minutes":
    "котировки TradingView с задержкой до 20 минут, каждые пять минут",
  "Hover or tap the chart to read a point.":
    "Наведите курсор или коснитесь графика, чтобы прочитать точку.",
  "from {prev}": "с {prev}",
  "Daily closes": "Дневные закрытия",
  "The last 36 hours": "Последние 36 часов",
  "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.":
    "Коллектор хранит этот индекс с {date}: пока {n} дневных закрытий. График пополняется на одно закрытие в день.",
  "No close kept yet.": "Закрытий пока нет.",
  "Perpetuals on it: {base}": "Бессрочные фьючерсы на него: {base}",
  "{n} markets, {oi} open interest": "{n} рынков, открытый интерес {oi}",
  "Its chart and order flow (CVD)": "Его график и поток ордеров (CVD)",
  "Its liquidations": "Его ликвидации",
  "Its option book: gamma exposure, Greeks and IV walls":
    "Его опционная книга: гамма-экспозиция, греки и IV-стены",
  "Every index on the World indexes tab": "Все индексы на вкладке «Мировые индексы»",
  "{name} index level": "Уровень индекса {name}",
  "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.":
    "{name}: текущий уровень, изменение и диапазон за день и дневные закрытия с тех пор, как сайт начал его читать.",
  "On this site": "На этом сайте",
  "The level is from {source}.": "Уровень берётся из источника: {source}.",
  "A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.":
    "Закрытие — последний уровень сессии; закрытый рынок показывает своё закрытие, пока не откроется снова. Дневные закрытия — последний уровень каждого дня по UTC.",
};
