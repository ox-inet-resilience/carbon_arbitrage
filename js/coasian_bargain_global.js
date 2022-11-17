import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
import {iso3166} from "./iso-3166-data.js"

// Data taken from https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/slim-2/slim-2.json
const alpha2ToName = {}
for (const el of iso3166) {
  alpha2ToName[el["alpha-2"]] = el["name"]
}


export async function main() {
  // Important: the unit is trillion, so we convert to billion later
  const dataRequest = await fetch("/public/country_specific_table_part4.csv")
  const data = await dataRequest.text()
  const parser = d => ({
    iso2: d.iso2,
    net_benefit: (+d.net_benefit * 1e3).toFixed(2),
    benefit: (+d.benefit * 1e3).toFixed(2),
    cost: (+d.cost * 1e3).toFixed(2),
    country_specific_scc: +d.country_specific_scc
  })
  const parsed = d3.csvParse(data, parser)

  const byLevelDevelopment = []
  for (const e of parsed) {
    let level
    if (levelDevelopmentMap["Developed Countries"].has(e.iso2)) {
      level = "Developed Countries"
    } else if (levelDevelopmentMap["Developing Countries"].has(e.iso2)) {
      level = "Developing Countries"
    } else if (levelDevelopmentMap["Emerging Market Countries"].has(e.iso2)) {
      level = "Emerging Market Countries"
    }
    // If not part of the 3 groups, ignore.
    if (!level) {
      continue
    }
    if (e.cost <= 0.0) {
      continue
    }
    byLevelDevelopment.push({
      iso2: e.iso2,
      level,
      net_benefit: e.net_benefit,
      cost: e.cost,
      benefit: e.benefit,
      social_cost_of_carbon: e.country_specific_scc,
    })
  }
  const jsonData = JSON.stringify(byLevelDevelopment)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `coasian_bargain_global.json`

  // Plotting
  const scatterplot = Plot.plot({
    x: {
      label: "PV country costs (bln dollars)",
      type: "log",
      tickFormat: "e",
    },
    y: {
      label: "PV country benefits (bln dollars)",
      type: "log",
      //tickFormat: d3.format(".0e"),
      tickFormat: "e",
    },
    marks: [
      Plot.dot(byLevelDevelopment, {
        x: "cost",
        y: "benefit",
        fill: "level",
        r: 4.5,
        title: (d) =>
          `${alpha2ToName[d.iso2]}\ncost: ${d.cost}\nbenefit: ${d.benefit}`
      }),
      // Diagonal line y = x
      Plot.line([[5e-3, 5e-3], [45000, 45000]])
    ],
    color: {
      legend: true,
      // Blue, green, orange, consistent with Seaborn muted colorscheme.
      range: ["#4878D0", "#6ACC64", "#EE854A"],
    },
    //tooltip: {
    //  stroke: "green", // When hovering over a circle
    //  r: 8,
    //}
    //color: {
    //  scheme: "Blues", // todo: say something about defaults / add link to color cheatsheet
    //  legend: true,
    //  ticks: 10,
    //  range: [.1,.9]
    //},
  })

  const container = document.getElementById("scatterplot")
  // Clear previous plot
  if (container.firstChild) {
    container.removeChild(container.firstChild)
  }
  container.appendChild(scatterplot)
}
