import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
import {iso3166} from "./iso-3166-data.js"

// Data taken from https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/slim-2/slim-2.json
const alpha2ToName = {}
for (const el of iso3166) {
  alpha2ToName[el["alpha-2"]] = el["name"].replace("United States of America", "USA")
}

export async function main() {
  const dataRequest = await fetch("/public/country_specific_data_part6.json")
  const data = await dataRequest.json()

  const jsonData = JSON.stringify(data)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `coasian_bargain_country.json`

  const regrouped = []
  for (const iso2 of Object.keys(data.unilateral_cost)) {
    regrouped.push({
      name: alpha2ToName[iso2],
      cost: data.unilateral_cost[iso2],
      benefit: data.unilateral_benefit[iso2],
      global_benefit: data.global_benefit[iso2],
    })
  }

  // Plotting
  const scatterplot = Plot.plot({
    x: {
      label: "PV country costs (bln dollars)",
      type: "log",
      tickFormat: "e",
      // We ensure the y range of the 2 plots are the same
      domain: [1.6e-05, 67.4]
    },
    y: {
      label: "PV country benefits (bln dollars)",
      type: "log",
      tickFormat: "e",
    },
    marks: [
      Plot.dot(regrouped, {
        x: "cost",
        y: "benefit",
        stroke: "name",
        r: 4.5,
        title: (d) =>
          `${d.name}\ncost: ${d.cost.toFixed(2)}\nbenefit: ${d.benefit.toFixed(3)}`
      }),
      // global benefit
      Plot.dot(regrouped, {
        x: "cost",
        y: "global_benefit",
        fill: "name",
        r: 4.5,
        title: (d) =>
          `${d.name}\ncost: ${d.cost.toFixed(2)}\nglobal benefit: ${d.global_benefit.toFixed(3)}`
      }),
      // Diagonal line y = x
      Plot.line([[2e-5, 2e-5], [67, 67]])
    ],
    color: {
      legend: true,
    },
  })
  const freeloaderMarks = []
  let index = 0
  for (const [iso2, entry] of Object.entries(data.freeloader_benefit)) {
    const countryDoingAction = alpha2ToName[iso2]
    const entryList = []
    for (const [freeloader_country, freeloader_benefit] of Object.entries(entry)) {
      entryList.push({
        name: alpha2ToName[freeloader_country],
        freeloader_benefit: freeloader_benefit,
        country_doing_action: countryDoingAction,
      })
    }
    freeloaderMarks.push(Plot.dot(entryList, {
      x: index,
      y: "freeloader_benefit",
      stroke: "country_doing_action",
      title: (d) =>
        `${d.name}\nfreeloader benefit: ${d.freeloader_benefit}`
    }))
    index += 1
  }
  const freeloaderplot = Plot.plot({
    x: {
      tickFormat: (e) => "",
      ticks: 1,
    },
    y: {
      label: "PV country benefits (bln dollars)",
      type: "log",
      tickFormat: "e",
      // We ensure the y range of the 2 plots are the same
      domain: [1.6e-05, 67.4]
    },
    marks: freeloaderMarks,
    width: 200,
  })

  const containerFreeloader = document.getElementById("freeloaderplot")
  const container = document.getElementById("scatterplot")
  // Clear previous 2 plots
  if (container.firstChild) {
    container.removeChild(container.firstChild)
    containerFreeloader.removeChild(containerFreeloader.firstChild)
  }
  containerFreeloader.appendChild(freeloaderplot)
  container.appendChild(scatterplot)
}
