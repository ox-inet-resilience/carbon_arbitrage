import {iso3166} from "./iso-3166-data.js"

// This is the data
import {sensitivityAnalysisResult} from "../public/website_sensitivity_coasian_1country_ID.js"

// Data taken from https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/slim-2/slim-2.json
const alpha2ToName = {}
for (const el of iso3166) {
  let name = el["name"]
  name = name.replace("United States of America", "USA")
  name = name.replace("United Kingdom of Great Britain and Northern Ireland", "GB")
  alpha2ToName[el["alpha-2"]] = name
}

// Round to nearest 2 decimal points.
for (const [k, v] of Object.entries(sensitivityAnalysisResult)) {
  v["unilateral_cost"] = v["unilateral_cost"].toFixed(2)
  v["unilateral_benefit"] = v["unilateral_benefit"].toFixed(2)
  v["global_benefit"] = v["global_benefit"].toFixed(2)
  for (const [k2, v2] of Object.entries(v["freeloader_benefit"])) {
    v["freeloader_benefit"][k2] = v2.toFixed(2)
  }
}

export function calculate() {
  const timeHorizon = document.getElementById("time-horizon").value

  const data = sensitivityAnalysisResult[timeHorizon]

  const jsonData = JSON.stringify(data)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `coasian_bargain_country_ID.json`

  const countryName = "Indonesia"
  data.name = countryName

  const minimum = data.freeloader_benefit["DK"] * 0.9
  const maximum = Math.max(data.freeloader_benefit["ROW"], data.global_benefit, data.unilateral_cost) * 1.1
  const range = [minimum, maximum]
  // Plotting
  const scatterplot = Plot.plot({
    x: {
      label: "PV country costs (bln dollars)",
      type: "log",
      tickFormat: "e",
      // We ensure the y range of the 2 plots are the same
      domain: range
    },
    y: {
      label: "PV country benefits (bln dollars)",
      type: "log",
      tickFormat: "e",
    },
    marks: [
      Plot.dot([[data.unilateral_cost, data.unilateral_benefit]], {
        stroke: () => countryName,
        fill: "white",
        r: 4.5,
        title: () => `${countryName}\ncost: ${data.unilateral_cost}\nbenefit: ${data.unilateral_benefit}`
      }),
      // global benefit
      Plot.dot([[data.unilateral_cost, data.global_benefit]], {
        fill: () => countryName,
        r: 4.5,
        title: () => `${countryName}\ncost: ${data.unilateral_cost}\nglobal benefit: ${data.global_benefit}`
      }),
      // Diagonal line y = x
      Plot.line([[minimum, minimum], [maximum, maximum]])
    ],
  })
  const legend = scatterplot.legend("color")
  const entryList = []
  for (const [freeloader_country, freeloader_benefit] of Object.entries(data["freeloader_benefit"])) {
    entryList.push({
      name: alpha2ToName[freeloader_country] || freeloader_country,
      freeloader_benefit: freeloader_benefit,
    })
  }
  const freeloaderMark = Plot.dot(entryList, {
    x: 0,
    y: "freeloader_benefit",
    stroke: "name",
    fill: "white",
    title: (d) =>
      `${d.name}\nfreeloader benefit: ${d.freeloader_benefit}`
  })
  const freeloaderplot = Plot.plot({
    x: {
      tickFormat: (e) => 0,
      ticks: 1,
    },
    y: {
      label: "PV country benefits (bln dollars)",
      type: "log",
      tickFormat: "e",
      // We ensure the y range of the 2 plots are the same
      domain: range
    },
    marks: [freeloaderMark],
    width: 200,
  })
  const legendFreeloader = freeloaderplot.legend("color")

  const containerFreeloader = document.getElementById("freeloaderplot")
  const container = document.getElementById("scatterplot")
  // Clear previous 2 plots
  if (container.firstChild) {
    container.removeChild(container.firstChild)
    container.removeChild(container.firstChild) // legend scatterplot
    container.removeChild(container.firstChild) // legend freeloader
    containerFreeloader.removeChild(containerFreeloader.firstChild)
  }
  containerFreeloader.appendChild(freeloaderplot)
  container.appendChild(scatterplot)
  container.appendChild(legend)
  container.appendChild(legendFreeloader)
}
