import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"
// This is the data
import {sensitivityAnalysisResult} from "./website_sensitivity_climate_financing.js"
import {_get_year_range_cost, discountRateMap, NGFS_PEG_YEAR} from "./common.js"

const calculatePlotData = (yearlyCostsDict, discountRateText) => {
  const plotData = []
  const yearStartEnds = [[NGFS_PEG_YEAR + 1, 2050], [2051, 2070], [2071, 2100]]
  const discountRate = discountRateMap[discountRateText]
  for (const [year_start, year_end] of yearStartEnds) {
    const byLevelDevelopment = {
      "World": _get_year_range_cost(discountRate, yearlyCostsDict, year_start, year_end),
      "Developed Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Developed world"]
      ),
      "Developing Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Developing world"]
      ),
      "Emerging Market Countries": _get_year_range_cost(
        discountRate, yearlyCostsDict, year_start, year_end, levelDevelopmentMap["Emerging markets"]
      )
    }

    const label = `${year_start}-${year_end}`
    for (const [k, v] of Object.entries(byLevelDevelopment)) {
      plotData.push({
        label,
        region: k,
        climate_financing: v,
      })
    }
    for (const [region, regionCountries] of Object.entries(byRegionMap)) {
      const _region_cost = _get_year_range_cost(
          discountRate, yearlyCostsDict, year_start, year_end, regionCountries
      )
      plotData.push({
        label,
        region,
        climate_financing: _region_cost,
      })
    }
  }
  return plotData
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
  const plotData = calculatePlotData(yearlyCostsDict, discountRate)

  const labels = ["2024-2050", "2051-2070", "2071-2100"]
  const sortedX = ["World", "Developed Countries", "Developing Countries", "Emerging Market Countries", "Asia", "Africa", "North America", "Latin America & the Carribean", "Europe", "Australia & New Zealand"]
  const plot = Plot.plot({
    width: 700,
    marginBottom: 130,
    x: {
      tickRotate: -45,
      domain: sortedX,
      label: null,
    },
    y: {
      tickFormat: "s",
      label: "Present value climate financing (trillion dollars)",
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
      Plot.ruleY([0])
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
