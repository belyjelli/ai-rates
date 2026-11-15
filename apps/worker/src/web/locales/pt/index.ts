/**
 * Portuguese, as written in Brazil (owner, 2026-11-15). One file per part of the site, so the catalog
 * for a page sits in one place and i18n.test.ts can tell two parts that translate the same English
 * differently. A reader in Portugal gets it too: any `pt` browser language lands here.
 *
 * GLOSSARY. One term, one translation, across every part. The words Brazilian crypto traders and the
 * exchanges' Portuguese pages use (Binance, Bybit, OKX in pt-BR, trading groups), not dictionary
 * Portuguese; much of the jargon stays English, as it does there.
 *
 *   funding rate        taxa de financiamento    perpetual (perp)  perpétuo
 *   funding (payment)   financiamento            spread            spread
 *   funding spread      spread de financiamento  exchange / venue  corretora
 *   market              mercado                  long / short      long / short
 *   go long on X        long em X                leg (of a pair)   perna
 *   pair                par                      open interest, OI open interest (OI)
 *   24h volume          volume em 24h            APR / annualized  APR (anualizado)
 *   settlement          pagamento                settled           pago
 *   interval            intervalo                backtest          backtest
 *   carry               carry                    arbitrage         arbitragem
 *   screener            screener                 rates             taxas
 *   liquidations        liquidações              taker / maker     taker / maker
 *   fees                tarifas                  slippage          slippage
 *   basis               basis                    mark price        preço de marcação
 *   index price         preço do índice          quote currency    moeda de cotação
 *   stability           estabilidade             win rate          taxa de acerto
 *   fear & greed        medo e ganância          bps               bps
 *   whale               baleia                   order book        livro de ofertas
 *   wall (in the book)  muralha                  CVD               CVD
 *   gamma flip          gamma flip               call / put wall   muralha de calls / de puts
 *   gamma exposure      exposição gama (GEX)     option book       livro de opções
 *   cascade             cascata                  member            membro
 *   flat (momentum)     lateral                  sign up / log in  cadastrar / entrar
 *   not financial advice  não é recomendação de investimento
 *
 * Style: address the reader as «você», in Brazilian spelling; short labels, since Portuguese runs
 * about a fifth longer than English and table heads, buttons and the nav must stay narrow (h, min, s,
 * d are the time units: "{h} h {m} min"). Curly quotes “ ” for quotes, never an ASCII double quote
 * (many keys sit in attributes). A count should read right for 1 and for many without agreeing with
 * its noun where a placeholder decides the number: "mercados: {count}" when in doubt. The site's
 * " · " separators, figures, venue names, tickers, units ($, %, bps) and code-like labels are left
 * exactly as they are, and so are the English product names (airrates, Telegram, MCP).
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { exchanges } from "./exchanges";
import { gamma } from "./gamma";
import { holdings } from "./holdings";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { narrator } from "./narrator";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const PT_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
  gamma,
  macro,
  exchanges,
  holdings,
  narrator,
};

export const pt: Catalog = Object.assign({}, ...Object.values(PT_PARTS));
