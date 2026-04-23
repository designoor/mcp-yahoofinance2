import YahooFinance from "yahoo-finance2";

export const yf = new YahooFinance({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
    allowAdditionalProps: true,
  },
  suppressNotices: ["yahooSurvey"],
  versionCheck: false,
});
