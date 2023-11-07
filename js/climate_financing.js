import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
import {_get_year_range_cost, discountRateMap, NGFS_PEG_YEAR, calculateGdpByRegionMap} from "./common.js"

// This is the data
const fetchResp = await fetch("./js/website_sensitivity_climate_financing.json")
const data = await fetchResp.json()
const fetchRespCoalExport = await fetch("./public/website_sensitivity_climate_financing_coal_export_over_battery.json")
const dataCoalExport = await fetchRespCoalExport.json()

const gdpMap = calculateGdpByRegionMap()

const arbitragePeriod = 1 + (2100 - (NGFS_PEG_YEAR + 1))

const calculatePlotData = (yearlyCostsDict, discountRateText, absoluteUnit) => {
  const plotData = []
  const yearStartEnds = [[NGFS_PEG_YEAR + 1, 2030], [2031, 2050], [2051, 2070], [2071, 2100]]

  const stringifyYearRange = (start, end) => `${start}-${end}`
  // For text annotation in the plot
  let annotationHeight = 0
  const yearRangeForAnnotation = [stringifyYearRange(...yearStartEnds[0]), stringifyYearRange(...yearStartEnds[1])]

  const discountRate = discountRateMap[discountRateText]

  for (const [year_start, year_end] of yearStartEnds) {
    const byLevelDevelopment = {
      "World": _get_year_range_cost(discountRate, yearlyCostsDict, year_start, year_end),
      "Developed Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Developed Countries"]
      ),
      "Developing Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Developing Countries"]
      ),
      "Emerging Market Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Emerging Market Countries"]
      )
    }

    const label = stringifyYearRange(year_start, year_end)
    for (const [k, v] of Object.entries(byLevelDevelopment)) {
      let cf
      if (absoluteUnit) {
        cf = v
      } else {
        // Division by 1e12 converts to trillion dollars, from dollars
        const denominator = gdpMap[k] / 1e12 * arbitragePeriod
        cf = denominator ? v / denominator * 100 : "N/A"
      }
      plotData.push({
        label,
        region: k,
        climate_financing: cf,
      })
      if (k == "World" && yearRangeForAnnotation.includes(label)) {
        // The height is world's CF from 2024 to 2050
        annotationHeight += cf
      }
    }
    for (const [region, regionCountries] of Object.entries(byRegionMap)) {
      const _region_cost = _get_year_range_cost(
          discountRate, yearlyCostsDict, year_start, year_end, regionCountries
      )
      let cf
      if (absoluteUnit) {
        cf = _region_cost
      } else {
        // Division by 1e12 converts to trillion dollars, from dollars
        const denominator = gdpMap[region] / 1e12 * arbitragePeriod
        cf = denominator ? _region_cost / denominator * 100 : "N/A"
      }
      plotData.push({
        label,
        region,
        climate_financing: cf,
      })
    }
  }
  return [plotData, annotationHeight]
}

export function calculate() {
  const _get = (id) => document.getElementById(id).value
  const coalReplacement = _get("coal-replacement")
  const lifetime = _get("lifetime-renewable-plants")
  const learningCurve = _get("learning-curve")
  const discountRate = _get("discount-rate")
  const energyStorage = _get("energy-storage")
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, energyStorage].join("_")
  const enableCoalExport = _get("coal-export") === "Enabled"
  const yearlyCostsDict = enableCoalExport ? dataCoalExport[key] : data[key]
  const unit = _get("requisite-climate-financing-unit")
  const absoluteUnit = unit === "Trillion dollars"
  const [plotData, annotationHeight] = calculatePlotData(yearlyCostsDict, discountRate, absoluteUnit)

  // Show raw data that can be copied/downloaded
  const jsonData = JSON.stringify(plotData)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `climate_financing_pv_${key}_${discountRate}_${unit}.json`

  // Plotting
  const labels = ["2024-2030", "2031-2050", "2051-2070", "2071-2100"]
  const sortedX = ["World", "Developed Countries", "Developing Countries", "Emerging Market Countries", "Asia", "Africa", "North America", "Latin America & the Carribean", "Europe", "Australia & New Zealand"]
  const ylabel = absoluteUnit ? "Present value of climate financing (trillion dollars)" : "Present value of climate financing / GDP of time period (%)"
  // 60% of the screen only if the screen size is huge.
  const width = window.screen.availWidth < 1200 ? window.screen.availWidth * 2 : window.screen.availWidth * 0.6
  const plot = Plot.plot({
    width,
    marginBottom: 130,
    x: {
      tickRotate: -45,
      domain: sortedX,
      label: null,
    },
    y: {
      tickFormat: "s",
      label: ylabel,
    },
    color: {
      scheme: "category10",
      domain: labels,
      legend: true,
    },
    marks: [
      Plot.barY(plotData, {
        x: "region",
        y: "climate_financing",
        fill: "label",
      }),
      Plot.ruleY([0]),
      // Vertical line to separate 2 different ways of grouping the countries.
      Plot.tickX(["Emerging Market Countries"], { strokeDasharray: "4 2", dx: width * 0.045}),
      // Texts describing the 2 different groupings.
      Plot.text(
        {length: 2},
        {
          x: ["Developing Countries", "North America"],
          y: [annotationHeight, annotationHeight],
          text: ["By level of\ndevelopment", "By region"],
        })
    ],
    style: {
      //fontSize: "14px",
    },
  })
  const container = document.getElementById("barchart")
  // Clear previous plot
  if (container.firstChild) {
    container.removeChild(container.firstChild)
  }
  container.appendChild(plot)
}
