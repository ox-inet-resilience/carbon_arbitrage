import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
// This is the data
import {sensitivityAnalysisResult} from "./website_sensitivity_climate_financing.js"

// Equivalent to Python's range(2022, 2100 + 1)
const wholeYears = Array.from(new Array(79), (x, i) => 2022 + i)

const addArray = (a, b) => {
    return a.map((e,i) => e + b[i])
}

const zeros = (length) => {
  return new Array(length).fill(0.0)
}

const _get_yearly_cost = (yearlyCostsDict, shortnames = null) => {
  let out = zeros(wholeYears.length)

  if (!shortnames) {
    // This means everything is summed, for "World"
    for (const [key, value] of Object.entries(yearlyCostsDict)) {
      out = addArray(out, value)
    }
    return out
  }

  for (const n of shortnames) {
    if (n in yearlyCostsDict) {
      out = addArray(out, yearlyCostsDict[n])
    }
  }
  return out
}

const calculatePlotData = (yearlyCostsDict, selectedRegion) => {
  const nameTranslation = {
    "Developed Countries": "Developed world",
    "Developing Countries": "Developing world",
    "Emerging Market Countries": "Emerging markets",
  }

  let yearlyCost
  if (selectedRegion == "World") {
    yearlyCost = _get_yearly_cost(yearlyCostsDict)
  } else if (selectedRegion in nameTranslation) {
    yearlyCost = _get_yearly_cost(yearlyCostsDict, levelDevelopmentMap[nameTranslation[selectedRegion]])
  } else if (selectedRegion in byRegionMap) {
    yearlyCost = _get_yearly_cost(yearlyCostsDict, byRegionMap[selectedRegion])
  } else {
    // This is for individual country
    yearlyCost = _get_yearly_cost(yearlyCostsDict, [selectedRegion])
    console.log(selectedRegion, yearlyCost)
  }
  const plotData = []
  for (const i in wholeYears) {
    plotData.push({
      year: wholeYears[i],
      cost: yearlyCost[i],
    })
  }
  return plotData
}

export function calculate() {
  const phaseoutScenario = document.getElementById("phaseout-scenario").value
  const coalReplacement = document.getElementById("coal-replacement").value
  const lifetime = document.getElementById("lifetime-renewable-plants").value
  const learningCurve = document.getElementById("learning-curve").value
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, phaseoutScenario].join("_")
  const yearlyCostsDict = sensitivityAnalysisResult[key + " NON-DISCOUNTED"]

  const selectedRegion = document.getElementById("by-region").value

  const plotData = calculatePlotData(yearlyCostsDict, selectedRegion)
  const plot = Plot.plot({
    width: 700,
    x: {
      label: "Time",
    },
    y: {
      label: "Annual climate financing (trillion dollars)",
    },
    marks: [
      Plot.line(plotData, {
        x: "year",
        y: "cost",
        // This is the green color taken from Seaborn's "deep" colorscheme.
        stroke: "#55a868",
        title: (d) => `${d.cost}\n${d.year}`,
      }),
    ],
  })
  const container = document.getElementById("timeseries")
  // Clear previous plot
  if (container.firstChild) {
    container.removeChild(container.firstChild)
  }
  container.appendChild(plot)
}
