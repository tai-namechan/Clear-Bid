export function calcFinancial(input: {
  contractYen: number
  feeRatePercent: number
  withholdingYen?: number
  expenseYen?: number
}) {
  const contractYen = Math.max(0, Math.floor(input.contractYen || 0))
  const feeYen = Math.floor((contractYen * (input.feeRatePercent || 0)) / 100)
  const withholdingYen = Math.max(0, Math.floor(input.withholdingYen || 0))
  const expenseYen = Math.max(0, Math.floor(input.expenseYen || 0))
  const preTaxTakeHomeYen = Math.max(0, contractYen - feeYen - withholdingYen - expenseYen)
  return { contractYen, feeYen, withholdingYen, expenseYen, preTaxTakeHomeYen }
}
