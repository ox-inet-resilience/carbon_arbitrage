function calculate() {
  const socialCostOfCarbon = document.getElementById("social-cost-of-carbon").value
  const timeHorizon = document.getElementById("time-horizon").value
  const coalReplacement = document.getElementById("coal-replacement").value
  const lifetime = document.getElementById("lifetime-renewable-plants").value
  const learningCurve = document.getElementById("learning-curve").value
  const discountRate = document.getElementById("discount-rate").value
  const phaseoutScenario = document.getElementById("phaseout-scenario").value
  const debug = [socialCostOfCarbon, timeHorizon, coalReplacement, lifetime, learningCurve.split("(")[0], discountRate].join("<br>")

  function setElement(id, name, relative = false) {
    let val = sensitivityAnalysisResult[learningCurve][parseInt(lifetime)][coalReplacement][timeHorizon][discountRate][socialCostOfCarbon][name][phaseoutScenario]
    if (relative) {
      val = val.toFixed(1) + " %"
    }
    document.getElementById(id).innerHTML = val
    return val
  }

  setElement("pv-benefits", "benefit")
  setElement("pv-costs", "cost")
  setElement("opportunity-costs", "opportunity_cost")
  setElement("investment-costs", "investment_cost")
  const caoTrillion = setElement("carbon-arbitrage", "cao")
  const cao = parseFloat(caoTrillion) * 1e12
  setElement("carbon-arbitrage-relative-gdp", "cao_relative", true)
  const productionAvoided = setElement("coal-production-prevented", "production_avoided")
  const emissionsAvoided = setElement("emissions-prevented", "emissions_avoided")
  document.getElementById("carbon-arbitrage-per-tcoal").innerHTML = (cao / (parseFloat(productionAvoided) * 1e9)).toFixed(0)
  document.getElementById("carbon-arbitrage-per-tco2").innerHTML = (cao / (parseFloat(emissionsAvoided) * 1e9)).toFixed(0)
  document.getElementById("temperature-increase").innerHTML = (1.5 * parseFloat(emissionsAvoided) / 1000).toFixed(2)
  //document.getElementById("debug").innerHTML = debug
}
