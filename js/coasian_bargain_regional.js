import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"

export async function main() {
  const dataRequest = await fetch("/public/country_specific_data_part5.json")
  const data = await dataRequest.json()
  // Convert trillion to billion
  for (const key of ["unilateral_cost", "unilateral_benefit"]) {
    for (const [key2, value2] of Object.entries(data[key])) {
      data[key][key2] = value2 * 1e3
    }
  }
  for (const [key, value] of Object.entries(data["freeloader_benefit"])) {
    for (const [key2, value2] of Object.entries(value)) {
      data["freeloader_benefit"][key][key2] = value2 * 1e3
    }
  }

  const jsonData = JSON.stringify(data)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `coasian_bargain_regional.json`
}
