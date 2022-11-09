import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"

export async function main() {
  const dataRequest = await fetch("/public/country_specific_data_part5.json")
  const data = await dataRequest.json()

  document.getElementById("result-data").innerHTML = JSON.stringify(data)
}
