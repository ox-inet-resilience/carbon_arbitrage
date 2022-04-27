import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
// This is the data
import {sensitivityAnalysisResult} from "./website_sensitivity_climate_financing.js"
import {_get_year_range_cost, discountRateMap, NGFS_PEG_YEAR, calculateGdpByRegionMap} from "./common.js"

const gdpMap = calculateGdpByRegionMap()

const arbitragePeriod = 1 + (2100 - (NGFS_PEG_YEAR + 1))

const calculatePlotData = (yearlyCostsDict, discountRateText, absoluteUnit) => {
  const plotData = []
  let maxCFValue = 0
  const yearStartEnds = [[NGFS_PEG_YEAR + 1, 2050], [2051, 2070], [2071, 2100]]
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

    const label = `${year_start}-${year_end}`
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
      maxCFValue = Math.max(maxCFValue, cf)
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
      maxCFValue = Math.max(maxCFValue, cf)
    }
  }
  return [plotData, maxCFValue]
}

export function calculate() {
  const _get = (id) => document.getElementById(id).value
  const phaseoutScenario = _get("phaseout-scenario")
  const coalReplacement = _get("coal-replacement")
  const lifetime = _get("lifetime-renewable-plants")
  const learningCurve = _get("learning-curve")
  const discountRate = _get("discount-rate")
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, phaseoutScenario].join("_")
  const yearlyCostsDict = sensitivityAnalysisResult[key + " NON-DISCOUNTED"]
  const unit = _get("requisite-climate-financing-unit")
  const absoluteUnit = unit === "Trillion dollars"
  const [plotData, maxCF] = calculatePlotData(yearlyCostsDict, discountRate, absoluteUnit)

  const labels = ["2024-2050", "2051-2070", "2071-2100"]
  const sortedX = ["World", "Developed Countries", "Developing Countries", "Emerging Market Countries", "Asia", "Africa", "North America", "Latin America & the Carribean", "Europe", "Australia & New Zealand"]
  const ylabel = absoluteUnit ? "Present value of climate financing (trillion dollars)" : "Present value of climate financing / GDP of time period (%)"
  // 60% of the screen
  const width = window.screen.availWidth * 0.6
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
          y: [maxCF, maxCF],
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
