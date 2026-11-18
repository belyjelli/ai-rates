import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts),
 * in Portuguese (Brazil). Glossary and style: ./index.ts.
 *
 * Terms, as Brazilian market media write them: the Fed (o Fed), FOMC, fed funds, target range faixa
 * da meta, effective rate taxa efetiva, interest on reserves juros sobre reservas (IORB), midpoint
 * ponto médio, cut / hold / hike corte / manutenção / alta, policy rate taxa básica, balance sheet
 * balanço, SEP, dot plot, Treasuries, yield rendimento, yield curve curva de juros, inverted
 * invertida, real yield rendimento real, breakeven inflação implícita, TIPS, reverse repo reverse repo,
 * net liquidity liquidez líquida, on the month no mês, year on year em 12 meses, annualized
 * anualizado, core núcleo, print divulgação, payrolls payroll, unemployment rate taxa de desemprego,
 * jobless claims pedidos de seguro-desemprego, job openings vagas abertas, average hourly earnings
 * salário médio por hora, Sahm rule regra de Sahm, retail sales vendas no varejo, industrial
 * production produção industrial, recession recessão, odds chances, middle estimate estimativa
 * central, pp p.p., bp bps, Commitments of Traders (COT), dealers, asset managers gestoras de ativos,
 * leveraged funds fundos alavancados, managed money, producers and merchants produtores e
 * comerciantes, swap dealers, net líquido, 3-year rank posição em 3 anos, stablecoin, supply oferta,
 * GDP PIB, CPI CPI (the US index; IPC in the prose that introduces it), crowd multidão, smart money.
 * Agency names stay as written: BLS, BEA, FRED, CFTC, CME, Kalshi, DefiLlama, GDPNow, NFCI, M2, SOFR,
 * JOLTS, E-mini and VIX.
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "Inflação (CPI)",
  CPI: "CPI",
  "Fed policy": "Política do Fed",
  Fed: "Fed",
  Employment: "Emprego",
  Jobs: "Emprego",
  Growth: "Crescimento",
  "Policy signals": "Sinais de política",
  Signals: "Sinais",
  "Positioning and flows": "Posicionamento e fluxos",
  Flows: "Fluxos",

  // Units, dates and the chart frame. "{n} pp" and "{n} bp" are suffixes after a signed figure.
  "{n} pp": "{n} p.p.",
  "{n} bp": "{n} bps",
  "{month} {year}": "{month} {year}",
  "Q{q} {year}": "T{q} {year}",
  "in {time}": "em {time}",
  "hover or tap the chart to read any point":
    "passe o mouse ou toque no gráfico para ler qualquer ponto",
  "{chart}; arrow keys read one point at a time": "{chart}; as setas leem um ponto por vez",

  // The release calendar.
  "PCE prices": "Preços PCE",
  "Jobs report": "Relatório de emprego",
  "Jobless claims": "Pedidos de seguro-desemprego",
  "Job openings (JOLTS)": "Vagas abertas (JOLTS)",
  GDP: "PIB",
  "Retail sales": "Vendas no varejo",
  "Industrial production": "Produção industrial",
  "FOMC decision": "Decisão do FOMC",
  "Coming up": "Próximas divulgações",

  // Kalshi's ladders and the footnotes.
  "below {value}": "abaixo de {value}",
  "above {value}": "acima de {value}",
  "middle estimate {value}": "estimativa central {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "Sem atualização desde {ago}: as últimas leituras destas fontes falharam, então os números são dessa época.",
  "{sources} Last read {ago}.": "{sources} Última leitura: {ago}.",

  // Inflation.
  "No inflation figures have been read yet.": "Nenhum dado de inflação foi lido ainda.",
  "CPI, year on year": "CPI em 12 meses",
  "{month}: {mom} on the month · core {core}": "{month}: {mom} no mês · núcleo {core}",
  "Core PCE, year on year": "Núcleo do PCE em 12 meses",
  "{month} · the measure the Fed's 2% target is set in":
    "{month} · a medida em que a meta de 2% do Fed é definida",
  "Next CPI": "Próximo CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi: {headline} no mês, núcleo {core}",
  "no date published yet": "data ainda não publicada",
  "5-year breakeven": "Inflação implícita de 5 anos",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "a inflação precificada nos Treasuries · 5y5y a termo {fwd}",
  "Inflation, year on year": "Inflação em 12 meses",
  "Core CPI": "Núcleo do CPI",
  PCE: "PCE",
  "Core PCE": "Núcleo do PCE",
  "Fed's 2% target": "Meta de 2% do Fed",
  "Inflation the bond market prices in": "Inflação precificada pelo mercado de títulos",
  "10-year breakeven": "Inflação implícita de 10 anos",
  "5y5y forward": "5y5y a termo",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "Inflação implícita: a diferença entre o rendimento de um Treasury nominal e o de um protegido contra a inflação do mesmo prazo. Semanal, o último fechamento de cada semana.",
  "Latest prints": "Últimas divulgações",
  Measure: "Medida",
  Month: "Mês",
  "On the month": "No mês",
  "3 months, annualized": "3 meses, anualizado",
  "6 months, annualized": "6 meses, anualizado",
  "Year on year": "Em 12 meses",
  "A year earlier": "Um ano antes",
  "CPI, on the month": "CPI no mês",
  "Core CPI, on the month": "Núcleo do CPI no mês",
  Inflation: "Inflação",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "O CPI é o índice de preços ao consumidor (IPC) do Bureau of Labor Statistics (BLS), publicado todo mês; o núcleo exclui alimentos e energia. O PCE é o índice de preços do consumo pessoal do Bureau of Economic Analysis (BEA), publicado cerca de duas semanas depois do CPI; a meta de 2% do Fed é definida nele, e o núcleo do PCE é o número que o Fed mais acompanha.",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "As variações são calculadas aqui a partir dos índices com ajuste sazonal: no mês, em três e seis meses anualizados (o ritmo recente, que o número em 12 meses demora a mostrar) e em 12 meses.",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "A inflação implícita é a inflação que o mercado de Treasuries precifica, a partir dos rendimentos diários do Fed: de 5 e de 10 anos, e a taxa de 5 anos que começa daqui a cinco anos (5y5y), que o Fed lê como expectativa de longo prazo.",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "A Kalshi, uma bolsa regulada pela CFTC, lista contratos que pagam se a próxima divulgação vier acima de um nível. Os preços são lidos como as chances dadas pelo mercado; a estimativa central é onde a chance de ficar acima cruza a metade.",
  "What Kalshi's traders expect": "O que os traders da Kalshi esperam",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "Fontes: BLS e BEA via FRED; inflação implícita dos rendimentos de Treasuries do Fed; chances da Kalshi.",

  // Fed policy.
  "cut more than 25 bp": "corte de mais de 25 bps",
  "cut 25 bp": "corte de 25 bps",
  hold: "manutenção",
  "hike 25 bp": "alta de 25 bps",
  "hike more than 25 bp": "alta de mais de 25 bps",
  "No Fed policy figures have been read yet.": "Nenhum dado de política do Fed foi lido ainda.",
  "Target range": "Faixa da meta",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "efetiva {effr} · SOFR {sofr} · juros sobre reservas {iorb}",
  "Next FOMC decision": "Próxima decisão do FOMC",
  "with projections": "com projeções",
  "Kalshi: {outcome} {p}": "Kalshi: {outcome} {p}",
  "Rate path the market prices": "Trajetória de juros precificada pelo mercado",
  "midpoint after {meeting}: {move} from today's {mid}":
    "ponto médio após {meeting}: {move} em relação aos {mid} de hoje",
  "no Kalshi odds read yet": "nenhuma chance da Kalshi lida ainda",
  "Fed balance sheet": "Balanço do Fed",
  "{change} over four weeks · week of {date}": "{change} em quatro semanas · semana de {date}",
  "A meeting with a Summary of Economic Projections":
    "Uma reunião com o Resumo de Projeções Econômicas (SEP)",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "As chances de cada reunião, da Kalshi",
  Meeting: "Reunião",
  "Cut &gt;25": "Corte &gt;25",
  "Cut 25": "Corte 25",
  Hold: "Manutenção",
  "Hike 25": "Alta 25",
  "Hike &gt;25": "Alta &gt;25",
  "Each outcome's move times its chance, added up":
    "O movimento de cada resultado vezes sua chance, somados",
  "Expected move": "Movimento esperado",
  "Today's midpoint plus every expected move to this meeting":
    "O ponto médio de hoje mais cada movimento esperado até esta reunião",
  "Implied midpoint": "Ponto médio implícito",
  "The Fed's own projections": "As projeções do próprio Fed",
  "Median, end of year": "Mediana, fim do ano",
  "Longer run": "Longo prazo",
  "Fed funds rate": "Taxa de fed funds",
  "PCE inflation": "Inflação PCE",
  "Core PCE inflation": "Inflação do núcleo do PCE",
  "Unemployment rate": "Taxa de desemprego",
  "Real GDP growth": "Crescimento do PIB real",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "Do Resumo de Projeções Econômicas de {date}: a mediana das projeções do comitê (o ponto do meio do dot plot, para os juros). Inflação e crescimento são quarto trimestre contra quarto trimestre; o desemprego é a média do quarto trimestre.",
  "Policy rate": "Taxa básica",
  "Top of the range": "Topo da faixa",
  "Bottom of the range": "Piso da faixa",
  "Effective rate": "Taxa efetiva",
  "Fed balance sheet, total assets": "Balanço do Fed, ativos totais",
  "Total assets": "Ativos totais",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "A faixa da meta é a faixa do Federal Open Market Committee (FOMC) para a taxa de fed funds; a taxa efetiva é onde os fed funds overnight de fato são negociados, o SOFR é a taxa de compromissadas overnight com Treasuries, e os juros sobre reservas são o que o Fed paga aos bancos, o que mantém a taxa efetiva dentro da faixa.",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "As chances são da Kalshi: para cada reunião, contratos que pagam num corte de mais de 25 pontos-base, num corte de 25 bps, numa manutenção, numa alta de 25 bps ou numa alta maior. Os preços de cada reunião são ajustados para somar 100%. O movimento esperado é o tamanho de cada resultado vezes sua chance; o ponto médio implícito soma cada movimento esperado a partir do ponto médio de hoje, uma trajetória como a que o FedWatch da CME traça a partir dos futuros de fed funds.",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "As projeções são do próprio comitê, publicadas quatro vezes por ano com o comunicado da reunião; o dot plot é a visão de cada membro sobre onde os juros devem estar no fim de cada ano.",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "O balanço são os ativos totais do Fed, semanal, com data de quarta-feira. Cresce quando o Fed compra títulos e encolhe conforme eles vencem.",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "Fontes: o Federal Reserve e o Fed de Nova York via FRED; o calendário do FOMC, do Federal Reserve; chances da Kalshi.",

  // Employment.
  "No employment figures have been read yet.": "Nenhum dado de emprego foi lido ainda.",
  "Payrolls, {month}": "Payroll, {month}",
  "jobs added on the month · three-month average {avg}":
    "vagas criadas no mês · média de três meses {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · regra de Sahm {sahm} (sinal de recessão a partir de 0.50)",
  "Initial jobless claims": "Pedidos iniciais de seguro-desemprego",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "semana até {date} · média de quatro semanas {avg} · contínuos {cont}",
  "Next jobs report": "Próximo relatório de emprego",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi: payroll {pay}, desemprego {u}",
  "Jobs added each month": "Vagas criadas a cada mês",
  "Payrolls, change on the month": "Payroll, variação no mês",
  "Three-month average": "Média de três meses",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "Payroll não agrícola, em milhares, com ajuste sazonal. Os dois últimos meses são revisados a cada relatório.",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "A regra de Sahm é a média de três meses da taxa de desemprego menos sua mínima dos últimos doze meses, em pontos percentuais; toda recessão nos EUA desde 1970 começou com ela em 0.50 ou mais. Uma lacuna é um mês sem pesquisa domiciliar.",
  "Initial claims": "Pedidos iniciais",
  "Four-week average": "Média de quatro semanas",
  "Latest figures": "Dados mais recentes",
  Latest: "Último",
  Context: "Contexto",
  "Average hourly earnings": "Salário médio por hora",
  "{month}, year on year · {mom} on the month": "{month}, em 12 meses · {mom} no mês",
  "Job openings": "Vagas abertas",
  "{month} · {before} a year earlier": "{month} · {before} um ano antes",
  "Continuing claims": "Pedidos contínuos",
  "week to {date}": "semana até {date}",
  Payrolls: "Payroll",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "O payroll e a taxa de desemprego vêm do relatório mensal de emprego do Bureau of Labor Statistics (BLS), em geral na primeira sexta-feira do mês: o payroll de uma pesquisa com empregadores, o desemprego de uma pesquisa com domicílios. Os pedidos de seguro-desemprego são a contagem semanal do Departamento do Trabalho de novos pedidos, a leitura mais rápida sobre demissões.",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "As vagas abertas vêm da pesquisa JOLTS, um mês atrás do relatório de emprego. O salário médio por hora é o que pagam os empregadores privados, uma medida da inflação de salários.",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "As chances são os contratos da Kalshi sobre o payroll e a taxa de desemprego do próximo relatório; a estimativa central é onde a chance de ficar acima cruza a metade.",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "Fontes: BLS e Departamento do Trabalho via FRED; chances da Kalshi.",

  // Growth.
  "No growth figures have been read yet.": "Nenhum dado de crescimento foi lido ainda.",
  "Real GDP, {quarter}": "PIB real, {quarter}",
  "on the quarter, annualized · recession probability {p}":
    "no trimestre, anualizado · probabilidade de recessão {p}",
  "GDPNow, {quarter}": "GDPNow, {quarter}",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "a estimativa contínua do Fed de Atlanta para o trimestre ainda não publicado",
  "Next GDP estimate": "Próxima estimativa do PIB",
  "Kalshi: {value} for {quarter}": "Kalshi: {value} para {quarter}",
  "Real GDP growth, annualized": "Crescimento do PIB real, anualizado",
  "Real GDP": "PIB real",
  "GDPNow estimate": "Estimativa GDPNow",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "Trimestre contra trimestre em taxa anualizada, como o Bureau of Economic Analysis publica; o número mais recente é revisado duas vezes.",
  "Activity, year on year": "Atividade em 12 meses",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "As vendas no varejo são em dólares, então incluem as altas de preço; a produção industrial é um índice de volume.",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "O PIB real é a medida do Bureau of Economic Analysis (BEA) da produção da economia descontada a inflação, trimestre contra trimestre em taxa anualizada. Cada trimestre tem a primeira estimativa cerca de um mês depois de terminar e é revisado duas vezes.",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "O GDPNow é a estimativa por modelo do Fed de Atlanta para o trimestre ainda não publicado, atualizada conforme saem os dados de cada mês; é um modelo, não uma previsão do Fed.",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "A produção industrial (o índice do Fed da produção de fábricas, mineração e serviços públicos) e as vendas no varejo (do Census Bureau) são mensais. A probabilidade de recessão é a do modelo de Chauvet e Piger, a partir de quatro indicadores mensais, como o FRED publica.",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "As chances são os contratos da Kalshi sobre a próxima estimativa do PIB.",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "Fontes: BEA, Federal Reserve, Census Bureau e Fed de Atlanta via FRED; chances da Kalshi.",

  // Policy signals.
  "No market signals have been read yet.": "Nenhum sinal de mercado foi lido ainda.",
  "2-year yield less fed funds": "Rendimento de 2 anos menos fed funds",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2 anos {two} acima da taxa efetiva: o mercado precifica juros mais altos em dois anos",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2 anos {two} abaixo da taxa efetiva: o mercado precifica cortes em dois anos",
  "Yield curve, 10-year less 2-year": "Curva de juros, 10 anos menos 2 anos",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10 anos menos 3 meses {s} · abaixo de zero a curva está invertida",
  "10-year real yield": "Rendimento real de 10 anos",
  "inflation-protected Treasury · nominal 10-year {ten}":
    "Treasury protegido contra a inflação · 10 anos nominal {ten}",
  "Net liquidity": "Liquidez líquida",
  "Fed assets less the Treasury's account and reverse repos":
    "Ativos do Fed menos a conta do Tesouro e os reverse repos",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "{change} em quatro semanas · ativos do Fed menos a conta do Tesouro e os reverse repos",
  "Treasury yields": "Rendimentos dos Treasuries",
  "3-month": "3 meses",
  "2-year": "2 anos",
  "10-year": "10 anos",
  "30-year": "30 anos",
  "Yield curve": "Curva de juros",
  "10-year less 2-year": "10 anos menos 2 anos",
  "10-year less 3-month": "10 anos menos 3 meses",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "Uma curva invertida, com rendimentos longos abaixo dos curtos, veio antes de toda recessão nos EUA desde os anos 1970, muitas vezes com um ano ou mais de antecedência; a volta para acima de zero muitas vezes veio mais perto dela.",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "Os ativos totais do Fed menos a Treasury General Account e a facilidade de reverse repo overnight: uma conta aproximada dos dólares que o balanço do Fed deixa no mercado, que muitos traders de cripto acompanham contra os preços.",
  "Other signals": "Outros sinais",
  "4 weeks": "4 semanas",
  "1 year": "1 ano",
  Reading: "Leitura",
  "Dollar, broad index": "Dólar, índice amplo",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "o dólar ponderado pelo comércio do Fed; um dólar em alta aperta as condições no mundo todo",
  "Financial conditions (NFCI)": "Condições financeiras (NFCI)",
  "below zero: looser than average": "abaixo de zero: mais frouxas que a média",
  "above zero: tighter than average": "acima de zero: mais apertadas que a média",
  "Money supply (M2)": "Oferta monetária (M2)",
  "{month}, year on year": "{month}, em 12 meses",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "O que o mercado de títulos diz sobre a política antes do Fed. O rendimento do Treasury de 2 anos acompanha onde os traders esperam a taxa básica nos próximos dois anos: bem acima da taxa efetiva, esperam alta; bem abaixo, esperam cortes.",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "A curva de juros é o rendimento de 10 anos menos o de 2 anos, e menos o da letra de 3 meses. Os rendimentos reais são os dos Treasuries protegidos contra a inflação (TIPS); um rendimento real alto é um custo alto para manter ativos que não pagam nada, cripto entre eles.",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "A liquidez líquida é o balanço do Fed menos o caixa do Tesouro no Fed e a facilidade de reverse repo, calculada aqui a partir dos dados semanais; é uma regra prática, não uma medida oficial. O NFCI é o índice de condições financeiras do Fed de Chicago, zero na média de longo prazo.",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "Fontes: rendimentos dos Treasuries, Federal Reserve e Fed de Chicago via FRED.",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "Bitcoin (CME)",
  "Ether (CME)": "Ether (CME)",
  "S&P 500 E-mini": "S&P 500 E-mini",
  "Nasdaq-100 E-mini": "Nasdaq-100 E-mini",
  "Russell 2000 E-mini": "Russell 2000 E-mini",
  "VIX futures": "Futuros de VIX",
  "2-year Treasury note": "Treasury note de 2 anos",
  "10-year Treasury note": "Treasury note de 10 anos",
  "Treasury bond": "Treasury bond",
  "3-month SOFR": "SOFR de 3 meses",
  "30-day fed funds": "Fed funds de 30 dias",
  "US dollar index": "Índice do dólar (DXY)",
  Euro: "Euro",
  "Japanese yen": "Iene japonês",
  Gold: "Ouro",
  Silver: "Prata",
  "WTI crude oil": "Petróleo WTI",
  Copper: "Cobre",

  // Positioning and flows: the tables, tiles and charts.
  "Leveraged funds": "Fundos alavancados",
  "Asset managers": "Gestoras de ativos",
  Dealers: "Dealers",
  "Managed money": "Managed money",
  "Producers and merchants": "Produtores e comerciantes",
  "Swap dealers": "Swap dealers",
  "Financial futures: who holds them": "Futuros financeiros: quem os detém",
  "Commodity futures: who holds them": "Futuros de commodities: quem os detém",
  "{group}, net": "{group}, líquido",
  Week: "Semana",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "Onde o líquido desta semana fica entre as semanas dos últimos três anos: 0% o mais short, 100% o mais long",
  "3-year rank": "Posição em 3 anos",
  "3 years": "3 anos",
  "No positioning data has been read yet.": "Nenhum dado de posicionamento foi lido ainda.",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "contratos líquidos, {share} do open interest · posição em 3 anos {rank} · {other} {otherNet}",
  "Stablecoin supply": "Oferta de stablecoins",
  "{d30} in 30 days · {d90} in 90 days": "{d30} em 30 dias · {d90} em 90 dias",
  "CME Bitcoin, leveraged funds": "Bitcoin na CME, fundos alavancados",
  "asset managers": "gestoras de ativos",
  "CME Ether, leveraged funds": "Ether na CME, fundos alavancados",
  "Gold, managed money": "Ouro, managed money",
  producers: "produtores",
  "Who holds CME Bitcoin futures": "Quem detém os futuros de Bitcoin da CME",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "Contratos líquidos (longs menos shorts) de cinco bitcoins cada, com data de cada terça-feira. Fundos alavancados são hedge funds e firmas de trading; boa parte do short deles é a perna de futuros de um cash-and-carry contra ETFs à vista, não uma aposta na queda.",
  "Dollar stablecoins in circulation": "Stablecoins de dólar em circulação",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "A oferta de todas as stablecoins atreladas ao dólar, somada pela DefiLlama: dólares já on-chain, o primeiro dinheiro a chegar aos preços de cripto.",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "Quem de fato detém os futuros, a partir do Commitments of Traders (COT) semanal da CFTC: posições de terça-feira, publicadas na sexta seguinte. Nos futuros financeiros a CFTC divide os traders em dealers (os bancos que fazem mercado), gestoras de ativos (fundos de pensão, seguradoras, fundos mútuos: mais lentos, dinheiro real) e fundos alavancados (hedge funds e firmas de trading: mais rápidos, especulativos). Nas commodities divide em produtores e comerciantes (hedgers), swap dealers e managed money (os especuladores).",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "Líquido é longs menos shorts, em contratos; sua parcela é do open interest do mercado. A posição em 3 anos diz onde o líquido desta semana fica entre todas as semanas dos últimos três anos: perto de 0% os especuladores estão tão short quanto já estiveram, perto de 100% tão long, que é quando o posicionamento costuma se desfazer.",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "A oferta de stablecoins são os dólares já on-chain, segundo a DefiLlama: quando cresce, dinheiro novo está chegando à cripto.",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "Fontes: Commitments of Traders da CFTC, só futuros{date}; DefiLlama para stablecoins.",
  ", report of {date}": ", relatório de {date}",
  "The macro data could not be read right now.": "Não foi possível ler os dados macro agora.",

  // Chart readout (slot-chart.ts).
  "week of {month} {day}, {year}": "semana de {day} {month} {year}",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1d",
  "1d change": "Variação 1d",
  "7d": "7d",
  "Another Fed hike in 2026": "Outra alta do Fed em 2026",
  "BTC odds": "Chances do BTC",
  "BTC: crowd vs options": "BTC: multidão vs opções",
  "Bitcoin above, {when}": "Bitcoin acima, {when}",
  "Bitcoin now": "Bitcoin agora",
  Chance: "Chance",
  "Change in the expected move over the last day": "Variação do movimento esperado no último dia",
  "Deribit index at the option chain's read": "Índice da Deribit na leitura da cadeia de opções",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Cadeia de opções da Deribit: Black-76 com a inclinação do smile, entre os vencimentos de cada lado",
  "Each FOMC meeting, both venues": "Cada reunião do FOMC, nas duas plataformas",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "Cada preço é a chance que os traders da plataforma dão ao resultado, seu preço de Sim; os resultados de uma reunião do Fed são ajustados para somar um. As variações são em pontos percentuais contra o preço de um dia e de uma semana antes. A Polymarket é lida a cada 15 minutos e guardada de hora em hora para sempre; as chances da Kalshi são as mesmas das abas Fed, Emprego e Crescimento.",
  "Fed cuts in 2026": "Cortes do Fed em 2026",
  "Fed rate at the end of 2026": "Juros do Fed no fim de 2026",
  "GDP growth, the quarter": "Crescimento do PIB, o trimestre",
  Gap: "Diferença",
  "How high US unemployment goes in 2026": "Até onde vai o desemprego nos EUA em 2026",
  "How high inflation gets in 2026": "Até onde vai a inflação em 2026",
  "How many Fed cuts in 2026": "Quantos cortes do Fed em 2026",
  "Kalshi median": "Mediana Kalshi",
  "Next settlement": "Próximo vencimento",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "Nenhuma escada de Bitcoin foi lida ainda. O coletor lê a Polymarket a cada 15 minutos.",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "Nenhum mercado de previsão foi lido ainda. O coletor lê a Polymarket a cada 15 minutos.",
  "Percentage points over the last day": "Pontos percentuais no último dia",
  "Percentage points over the last week": "Pontos percentuais na última semana",
  "Polymarket less options, in percentage points": "Polymarket menos opções, em pontos percentuais",
  "Polymarket median": "Mediana Polymarket",
  "Polymarket's change over the last day, in percentage points":
    "Variação da Polymarket no último dia, em pontos percentuais",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.":
    "As escadas da Polymarket são resolvidas pelo fechamento de um minuto do BTC/USDT da Binance ao meio-dia de Nova York. A coluna de opções é o que a cadeia de BTC mais recente da Deribit implica para o mesmo preço e momento: a volatilidade de cada strike tirada do smile, a chance de fechar acima dele contando a inclinação do smile, a variância total lida entre os vencimentos de cada lado. Uma diferença positiva significa que a multidão da Polymarket dá ao preço chances melhores que as opções. Smart $ é o que as carteiras smart (as mais lucrativas do ranking, como na aba Mercados de previsão) têm no Sim menos o que têm no Não.",
  "Polymarket's median outcome": "Resultado mediano da Polymarket",
  "Prediction markets": "Mercados de previsão",
  Predictions: "Previsões",
  Print: "Divulgação",
  Settles: "Vence",
  "The Fed rate at the end of 2026": "Os juros do Fed no fim de 2026",
  "The next prints, both venues": "As próximas divulgações, nas duas plataformas",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "A faixa de resultado em que as chances da Polymarket, em ordem, passam da metade",
  "The prediction markets could not be read right now.":
    "Não foi possível ler os mercados de previsão agora.",
  "The year ahead, on Polymarket": "O ano à frente, na Polymarket",
  "US GDP growth in 2026": "Crescimento do PIB dos EUA em 2026",
  "US recession": "Recessão nos EUA",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "Onde a escada de chances acima de X da Kalshi cruza a metade",
  "Widest gap": "Maior diferença",
  "above {price} on {date}: the crowd is {side} than the options":
    "acima de {price} em {date}: a multidão está {side} que as opções",
  bp: "bps",
  "by the end of each year": "até o fim de cada ano",
  "crowd median {crowd} · options median {options}":
    "mediana da multidão {crowd} · mediana das opções {options}",
  "more bearish": "mais baixista",
  "more bullish": "mais altista",
  "no option chain read yet": "nenhuma cadeia de opções lida ainda",
  "noon New York": "meio-dia de Nova York",
  "{change} pp over a week": "{change} p.p. em uma semana",
  "{n} more outcomes under 1%": "Mais resultados abaixo de 1%: {n}",
  "Change in the smart share over the last day, in percentage points":
    "Variação da parcela smart no último dia, em pontos percentuais",
  Crowd: "Multidão",
  "Fed, {meeting}": "Fed, {meeting}",
  No: "Não",
  Question: "Pergunta",
  "Share of smart $": "Parcela do smart $",
  "Smart $": "Smart $",
  "Smart money backs": "O smart money aposta em",
  "Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.":
    "Smart money são as {n} carteiras com mais lucro no próprio ranking da Polymarket em Economia e em Cripto, no último mês ou desde sempre. Os 100 maiores detentores de cada resultado em cada mercado são lidos a cada hora; uma carteira smart com menos que isso não aparece. Onde o smart money e o preço da multidão divergem, um lado está errado, e o lado smart tem o melhor histórico.",
  "Smart money on Polymarket": "Smart money na Polymarket",
  "That outcome's share of the smart wallets' dollars on the question":
    "A parcela daquele resultado nos dólares das carteiras smart na pergunta",
  "The crowd's price for that outcome": "O preço da multidão para aquele resultado",
  "The smart wallets' dollars on Yes less their dollars on No":
    "Os dólares das carteiras smart no Sim menos seus dólares no Não",
  Wallets: "Carteiras",
  Yes: "Sim",
  // World indexes tab (web/indexes.ts)
  Country: "País",
  "World indexes": "Índices mundiais",
  Indexes: "Índices",
  India: "Índia",
  Japan: "Japão",
  Korea: "Coreia",
  Singapore: "Singapura",
  Australia: "Austrália",
  Americas: "Américas",
  "Middle East": "Oriente Médio",
  Canada: "Canadá",
  Brazil: "Brasil",
  Mexico: "México",
  Germany: "Alemanha",
  "United Kingdom": "Reino Unido",
  France: "França",
  "Euro area": "Zona do euro",
  Netherlands: "Holanda",
  Spain: "Espanha",
  Italy: "Itália",
  Switzerland: "Suíça",
  Portugal: "Portugal",
  Belgium: "Bélgica",
  Austria: "Áustria",
  Sweden: "Suécia",
  Denmark: "Dinamarca",
  Poland: "Polônia",
  Turkey: "Turquia",
  Israel: "Israel",
  "Saudi Arabia": "Arábia Saudita",
  "Hong Kong": "Hong Kong",
  China: "China",
  Taiwan: "Taiwan",
  Thailand: "Tailândia",
  Indonesia: "Indonésia",
  Philippines: "Filipinas",
  Malaysia: "Malásia",
  Vietnam: "Vietnã",
  Other: "Outros",
  "{n} daily closes, {change}%": "{n} fechamentos diários, {change}%",
  "Its option book on the Gamma Exposure tab": "Seu livro de opções na aba Exposição gama",
  live: "ao vivo",
  closing: "fechamento",
  "The index levels could not be read right now.":
    "Não foi possível ler os níveis dos índices agora.",
  "No index level has been read yet. The collector reads them every five minutes.":
    "Nenhum nível de índice foi lido ainda. O coletor os lê a cada cinco minutos.",
  "Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.":
    "Níveis de índices de ações das Américas, Europa, Oriente Médio e Ásia-Pacífico: a variação do dia contra o fechamento anterior, a faixa do dia e um mês de fechamentos diários.",
  Index: "Índice",
  Level: "Nível",
  Change: "Variação",
  "Day range": "Faixa do dia",
  "India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close.":
    "Os índices Nifty da Índia, o Nifty Bank e o India VIX vêm do arquivo diário de fechamento da NSE, lido uma vez por noite. Os demais são lidos a cada cinco minutos: KOSPI e KOSPI 200 da Korea Exchange, Nikkei 225, TOPIX, Straits Times e S&P/ASX 200 das cotações da Sina, e os outros índices de cotações com atraso de até 20 minutos; um mercado que já fechou mostra seu fechamento.",
  // An index's page (web/index-page.ts)
  "No index {ticker}.": "Não há índice {ticker}.",
  "the Korea Exchange's own index charts, every five minutes":
    "os próprios gráficos de índices da Korea Exchange, a cada cinco minutos",
  "Sina's quote feed, every five minutes": "o feed de cotações da Sina, a cada cinco minutos",
  "NSE's daily closing file, read once each evening":
    "o arquivo diário de fechamento da NSE, lido uma vez por noite",
  "TradingView's quotes, up to 20 minutes behind, every five minutes":
    "as cotações do TradingView, com até 20 minutos de atraso, a cada cinco minutos",
  "Yahoo Finance's quotes, every five minutes":
    "as cotações do Yahoo Finance, a cada cinco minutos",
  "Hover or tap the chart to read a point.": "Passe o mouse ou toque no gráfico para ler um ponto.",
  "from {prev}": "de {prev}",
  "Daily closes": "Fechamentos diários",
  "The last 36 hours": "As últimas 36 horas",
  "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.":
    "O coletor guarda este índice desde {date}: {n} fechamentos diários até agora. O gráfico ganha um fechamento por dia.",
  "No close kept yet.": "Nenhum fechamento guardado ainda.",
  "Perpetuals on it: {base}": "Perpétuos sobre ele: {base}",
  "{n} markets, {oi} open interest": "mercados: {n}, open interest {oi}",
  "Its chart and order flow (CVD)": "Seu gráfico e fluxo de ordens (CVD)",
  "Its liquidations": "Suas liquidações",
  "Its option book: gamma exposure, Greeks and IV walls":
    "Seu livro de opções: exposição gama, gregas e muralhas de IV",
  "Every index on the World indexes tab": "Todos os índices da aba Índices mundiais",
  "{name} index level": "Nível do índice {name}",
  "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.":
    "{name}: o nível agora, a variação e a faixa do dia, e os fechamentos diários guardados desde que o site começou a lê-lo.",
  "On this site": "Neste site",
  "The level is from {source}.": "O nível vem de {source}.",
  "A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.":
    "Um fechamento é o último nível do pregão; um mercado fechado mostra seu fechamento até reabrir. Os fechamentos diários são o último nível de cada dia UTC.",
  Table: "Tabela",
  "Return map": "Mapa de retorno",
  "By country": "Por país",
  View: "Visão",
  "5 days": "5 dias",
  "the last 5 sessions": "os últimos 5 pregões",
  "the last 21 sessions": "os últimos 21 pregões",
  "Europe and the Middle East": "Europa e Oriente Médio",
  "Markets with too little history for this window yet, left out: {n}.":
    "Mercados ainda com pouco histórico para esta janela, deixados de fora: {n}.",
  "Too little history for this window yet.": "Ainda há pouco histórico para esta janela.",
  "{market} · {name}: {ret} over {span}, {day} in the latest session, {swing} on a typical day":
    "{market} · {name}: {ret} em {span}, {day} no último pregão, {swing} num dia típico",
  "{n} markets, {up} up over {span} · hover or tap a bubble to read it":
    "mercados: {n}, em alta em {span}: {up} · passe o mouse ou toque numa bolha para ver o valor",
  "Return over {span} against the latest session, one index per market":
    "Retorno em {span} contra o último pregão, um índice por mercado",
  "bubble size: the typical daily move": "tamanho da bolha: o movimento diário típico",
  "Markets by return over {span} and the latest session":
    "Mercados por retorno em {span} e no último pregão",
  "Return over {span}": "Retorno em {span}",
  "Change in the latest session": "Variação no último pregão",
  "{market} over {span}: {list}": "{market} em {span}: {list}",
  "{n} markets · hover or tap a row to read it":
    "mercados: {n} · passe o mouse ou toque numa linha para ver o valor",
  "Each market's indexes by return over {span}: the bar is its first index in the table, a dot each of its others":
    "Os índices de cada mercado por retorno em {span}: a barra é o primeiro índice dele na tabela, um ponto cada um dos outros",
  "other indexes": "outros índices",
  "Volatility indexes (VIX, India VIX) are left out of the charts: their moves are not returns.":
    "Os índices de volatilidade (VIX, India VIX) ficam fora dos gráficos: seus movimentos não são retornos.",
  // The homepage's prediction-market section (web/bets.ts).
  "What the crowd is betting on": "No que a multidão está apostando",
  "Prediction markets on Polymarket and Kalshi: the question we pinned, the one with the most money traded over the last 24 hours on either venue, and the next ones, at least three from each venue. Sports are left out, and so are the short questions that repeat every day or week (today's Bitcoin range, tomorrow's weather, a week of tweets).":
    "Mercados de previsão na Polymarket e na Kalshi: a pergunta que fixamos, a que teve mais dinheiro negociado nas últimas 24 horas em qualquer das duas e as seguintes, pelo menos três de cada uma. Esportes ficam de fora, assim como as perguntas curtas que se repetem todo dia ou toda semana (a faixa do Bitcoin hoje, o clima de amanhã, uma semana de tweets).",
  "A price is the crowd's chance: a Yes share at 9¢ pays $1 if it happens, so the crowd puts it at 9%. Kalshi counts its volume in contracts that pay $1; here it is contracts times their price, the dollars paid, as Polymarket counts it. The charts are each venue's own price history. Read every five minutes.":
    "O preço é a chance segundo a multidão: uma cota Yes a 9¢ paga $1 se acontecer, então a multidão dá 9% de chance. A Kalshi conta o volume em contratos que pagam $1; aqui são contratos vezes o preço, os dólares pagos, como a Polymarket conta. Os gráficos são o histórico de preços de cada plataforma. Lido a cada cinco minutos.",
  "The prediction markets could not be read just now.":
    "Não foi possível ler os mercados de previsão agora.",
  "Chance of Yes since {date}": "Chance de Yes desde {date}",
  "{question}: the chance of each answer over time":
    "{question}: a chance de cada resposta ao longo do tempo",
  "pts in 24h": "p.p. em 24h",
  "Traded since {date}": "Negociado desde {date}",
  Traded: "Negociado",
  "{venue} has {n} more": "{venue}: mais {n}",
  "The likeliest answer; for a question asked by date, the nearest date; for levels that can all come true, the one closest to even odds":
    "A resposta mais provável; numa pergunta por data, a data mais próxima; em níveis que podem se realizar juntos, o mais perto de 50%",
  "Leading answer": "Resposta líder",
  "Change in the chance over the last 24 hours, in percentage points":
    "Variação da chance nas últimas 24 horas, em pontos percentuais",
  "Pinned until {date}": "Fixado até {date}",
  "Most traded in the last 24 hours": "Mais negociado nas últimas 24 horas",
  "No open question on Polymarket or Kalshi right now.":
    "Nenhuma pergunta aberta na Polymarket ou na Kalshi agora.",
  "Prices and volumes from Polymarket and Kalshi, read {time}. A chance is the price of a Yes share; it is what the crowd is paying, not a forecast of ours.":
    "Preços e volumes da Polymarket e da Kalshi, lidos às {time}. A chance é o preço de uma cota Yes; é o que a multidão está pagando, não uma previsão nossa.",
  // The homepage section's automatic pin (web/bets.ts, app/pin-finder.ts).
  "Picked automatically until {date}": "Escolhido automaticamente até {date}",
  "A story across {n} questions": "Uma história em {n} perguntas",
  "On Polymarket and Kalshi": "Na Polymarket e na Kalshi",
  "{volume} traded on it in 24h": "{volume} negociados nela em 24h",
  "Polymarket's featured #{n}": "Destaque nº {n} da Polymarket",
  "New since {date}": "Nova desde {date}",
  "When nothing is pinned by hand, the biggest new story is pinned by itself for three days. Questions that share a topic Polymarket tagged in the last month are one story; it scores the money traded on it over 24 hours, more for questions opened this week, for markets, companies, the economy and tech, and for what Polymarket features. It is pinned when it scores at least half as much again as any other, and a story twice its size takes the pin sooner. The card says why it was picked.":
    "Quando nada é fixado à mão, a maior história nova é fixada sozinha por três dias. Perguntas que compartilham um tema marcado pela Polymarket no último mês são uma história; ela pontua pelo dinheiro negociado em 24 horas, com mais peso para perguntas abertas nesta semana, para mercados, empresas, economia e tecnologia, e para o que a Polymarket destaca. Ela é fixada quando pontua pelo menos metade a mais que qualquer outra, e uma história com o dobro do tamanho toma o lugar antes. O cartão diz por que ela foi escolhida.",
};
