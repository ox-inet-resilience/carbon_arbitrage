import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
import {calculateGdpByRegionMap} from "./common.js"
import {gdpMarketcap2020} from "./all_countries_gdp_marketcap_2020_data.js"

// This is the data
const fetchResp = await fetch("./js/website_sensitivity_climate_financing.json")
const data = await fetchResp.json()
const fetchRespCoalExport = await fetch("./public/website_sensitivity_climate_financing_coal_export_over_battery.json")
const dataCoalExport = await fetchRespCoalExport.json()

const gdpMap = calculateGdpByRegionMap()

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

const calculatePlotData = (yearlyCostsDict, selectedRegion, absoluteUnit) => {
  let yearlyCost
  let multiplier = 1
  if (selectedRegion == "World") {
    yearlyCost = _get_yearly_cost(yearlyCostsDict)
    if (!absoluteUnit) {
      // Division by 1e9 converts from dollars to billion dollars
      multiplier = 100 / (gdpMap["World"] / 1e9)
    }
  } else if (selectedRegion in levelDevelopmentMap) {
    yearlyCost = _get_yearly_cost(yearlyCostsDict, levelDevelopmentMap[selectedRegion])
    if (!absoluteUnit) {
      multiplier = 100 / (gdpMap[selectedRegion] / 1e9)
    }
  } else if (selectedRegion in byRegionMap) {
    yearlyCost = _get_yearly_cost(yearlyCostsDict, byRegionMap[selectedRegion])
    if (!absoluteUnit) {
      multiplier = 100 / (gdpMap[selectedRegion] / 1e9)
    }
  } else {
    // This is for individual country
    yearlyCost = _get_yearly_cost(yearlyCostsDict, [selectedRegion])
    if (!absoluteUnit) {
      multiplier = 100 / (gdpMarketcap2020[selectedRegion] / 1e9)
    }
  }
  const plotData = []
  for (const i in wholeYears) {
    plotData.push({
      year: wholeYears[i],
      // Multiplication by 1e3 converts to billion dollars
      cost: multiplier ? yearlyCost[i] * 1e3 * multiplier : 0.0,
    })
  }
  return plotData
}

export function calculate() {
  const _get = (id) => document.getElementById(id).value
  const coalReplacement = _get("coal-replacement")
  const lifetime = _get("lifetime-renewable-plants")
  const learningCurve = _get("learning-curve")
  const energyStorage = _get("energy-storage")
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, energyStorage].join("_")
  const enableCoalExport = _get("coal-export") === "Enabled"
  const yearlyCostsDict = enableCoalExport ? dataCoalExport[key] : data[key]

  const selectedRegion = _get("by-region")

  const unit = _get("requisite-climate-financing-unit")
  const absoluteUnit = unit === "Billion dollars"

  const plotData = calculatePlotData(yearlyCostsDict, selectedRegion, absoluteUnit)

  // Show raw data that can be copied/downloaded
  const formattedData = {
    years: plotData.map(item => item.year),
    // Round to 5 decimal places.
    cost: plotData.map(item => parseFloat(item.cost.toFixed(5))),
  }
  const jsonData = JSON.stringify(formattedData)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `climate_financing_yearly_${key}_${selectedRegion}_${unit}.json`

  const ylabel = absoluteUnit ? "Annual climate financing (billion dollars) — non-discounted" : "Annual climate financing / GDP (%) — non-discounted"
  // 60% of the screen only if the screen size is huge.
  const width = window.screen.availWidth < 1200 ? window.screen.availWidth * 2 : window.screen.availWidth * 0.6
  const plot = Plot.plot({
    width,
    x: {
      label: "Time",
    },
    y: {
      label: ylabel,
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
