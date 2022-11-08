// This is the data
import {sensitivityAnalysisResult} from "./coal_worker_sensitivity_analysis.js"

export function calculate() {
  const _get = (id) => document.getElementById(id).value
  const discountRate = _get("discount-rate")

  const data = sensitivityAnalysisResult[discountRate]

  // Update output
  const sumValues = obj => Object.values(obj).reduce((a, b) => a + b, 0)
  const lostWageObj = data["compensation workers for lost wages"]
  document.getElementById("pv-lost-wage").innerHTML = sumValues(lostWageObj).toFixed(1)
  const retrainCostObj = data["retraining costs"]
  document.getElementById("pv-retraining-cost").innerHTML = sumValues(retrainCostObj).toFixed(1)

  // Show raw data that can be copied/downloaded
  const jsonData = JSON.stringify(data)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `climate_financing_coal_worker_${discountRate}.json`
}
