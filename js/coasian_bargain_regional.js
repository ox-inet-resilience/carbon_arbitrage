import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"

export async function main() {
  const dataRequest = await fetch("/public/country_specific_data_part5.json")
  const data = await dataRequest.json()

  const jsonData = JSON.stringify(data)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `coasian_bargain_regional.json`
}
