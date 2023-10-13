// This is the data
const fetchResp = await fetch("./public/website_sensitivity_analysis_result.json")
const sensitivityAnalysisResult = await fetchResp.json()

export function calculate() {
  const socialCostOfCarbon = document.getElementById("social-cost-of-carbon").value
  const timeHorizon = document.getElementById("time-horizon").value
  const coalReplacement = document.getElementById("coal-replacement").value
  const lifetime = document.getElementById("lifetime-renewable-plants").value
  const learningCurve = document.getElementById("learning-curve").value
  const discountRate = document.getElementById("discount-rate").value

  function setElement(id, name) {
    let val = sensitivityAnalysisResult[learningCurve][parseInt(lifetime)][coalReplacement][timeHorizon][discountRate][socialCostOfCarbon][name]
    document.getElementById(id).innerHTML = val
    return val
  }

  const benefit = setElement("pv-benefits", "b")
  const cost = setElement("pv-costs", "c")
  setElement("opportunity-costs", "oc")
  setElement("investment-costs", "ic")

  // Carbon arbitrage relative to GDP
  const caoTrillion = benefit - cost
  const cao = caoTrillion * 1e12
  // See the analysis_main.py of https://github.com/ox-inet-resilience/carbon_arbitrage_code
  // for world_gdp_2020 and arbitrage_period.
  const world_gdp_2020 = 84.705  // trillion dolars
  const NGFS_PEG_YEAR_ORIGINAL = 2023
  const last_year = parseInt(timeHorizon)
  const arbitrage_period = 1 + (last_year - (NGFS_PEG_YEAR_ORIGINAL + 1))
  const caoRelative = caoTrillion * 100 / (world_gdp_2020 * arbitrage_period)
  document.getElementById("carbon-arbitrage").innerHTML = caoTrillion.toFixed(2)
  document.getElementById("carbon-arbitrage-relative-gdp").innerHTML = caoRelative.toFixed(1) + " %"

  const productionAvoided = setElement("coal-production-prevented", "production")
  const emissionsAvoided = setElement("emissions-prevented", "emissions")
  document.getElementById("carbon-arbitrage-per-tcoal").innerHTML = (cao / (parseFloat(productionAvoided) * 1e9)).toFixed(0)
  document.getElementById("carbon-arbitrage-per-tco2").innerHTML = (cao / (parseFloat(emissionsAvoided) * 1e9)).toFixed(0)
  document.getElementById("temperature-increase").innerHTML = (1.5 * parseFloat(emissionsAvoided) / 1000).toFixed(2)
}
