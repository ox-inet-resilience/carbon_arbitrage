import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"

export async function main() {
  const dataRequest = await fetch("/public/country_specific_table_part4.csv")
  const data = await dataRequest.text()
  const parser = d => ({
    iso2: d.iso2,
    net_benefit: +d.net_benefit,
    benefit: +d.benefit,
    cost: +d.cost,
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
  document.getElementById("result-data").innerHTML = JSON.stringify(byLevelDevelopment)

  //// Plotting
  //const scatterplot = Plot.plot({
  //  x: {
  //    label: "PV country costs (bln dollars)",
  //  },
  //  y: {
  //    label: "PV country benefits (bln dollars)",
  //  },
  //  marks: [
  //    //Plot.frame({stroke: "#ccc"}), // draws a light grey (#ccc) frame mark around the Plot
  //    Plot.dot(byLevelDevelopment, {
  //      x: "cost",
  //      y: "benefit",
  //      //fill: "color",
  //      //r: "level",
  //    })
  //  ],
  //  //color: {
  //  //  scheme: "Blues", // todo: say something about defaults / add link to color cheatsheet
  //  //  legend: true,
  //  //  ticks: 10,
  //  //  range: [.1,.9]
  //  //},
  //  //height: 300,
  //  //width: 350
  //})

  //const container = document.getElementById("scatterplot")
  //// Clear previous plot
  //if (container.firstChild) {
  //  container.removeChild(container.firstChild)
  //}
  //container.appendChild(scatterplot)
}
