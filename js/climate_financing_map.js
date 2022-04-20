// Based on https://d3-graph-gallery.com/graph/choropleth_hover_effect.html

// This is the data
import {sensitivityAnalysisResult} from "./website_sensitivity_climate_financing.js"
import {gdpMarketcap2020} from "./all_countries_gdp_marketcap_2020_data.js"
import {calculateDiscountedSum, discountRateMap, NGFS_PEG_YEAR} from "./common.js"
import {Legend} from "./d3-color-legend.js"

const arbitragePeriod = yearEnd => 1 + (yearEnd - (NGFS_PEG_YEAR + 1))
const yearEndDefaultValue = 2100

// Data taken from https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/slim-2/slim-2.json
const isoNumber2Alpha2 = {}
for (const el of iso3166) {
  isoNumber2Alpha2[el["country-code"]] = el["alpha-2"]
}

const linspace = (start, stop, num, endpoint = true) => {
    const div = endpoint ? (num - 1) : num
    const step = (stop - start) / div
    return Array.from({length: num}, (_, i) => start + step * i)
}

const getMax = obj => {
  const key = Object.keys(obj).reduce(function(a, b){ return obj[a] > obj[b] ? a : b })
  return obj[key]
}

const getMin = obj => {
  const key = Object.keys(obj).reduce(function(a, b){ return obj[a] < obj[b] ? a : b })
  return obj[key]
}

const calculateCostDict = (key, discountRateText, yearEnd) => {
  const discountRate = discountRateMap[discountRateText]
  const yearlyCostsDict = sensitivityAnalysisResult[key + " NON-DISCOUNTED"]
  const costDict = {}
  const yearStart = NGFS_PEG_YEAR + 1
  for (const [key, value] of Object.entries(yearlyCostsDict)) {
    // Multiplication by 1e3 converts trillion dollars to billion dollars
    const summed = calculateDiscountedSum(value.slice(yearStart - 2022, yearEnd - 2022 + 1), discountRate, yearStart) * 1e3
    costDict[key] = summed
  }
  return costDict
}

const calculateColorScale = (_costDict) => d3.scaleThreshold()
  .domain(linspace(getMin(_costDict), getMax(_costDict), 6))
  .range(d3.schemeBlues[7])

const setLegend = (_colorScale, absoluteUnit) => {
  const legendContainer = document.getElementById("legend")
  if (legendContainer.firstChild) {
    legendContainer.removeChild(legendContainer.firstChild)
  }
  const legend = Legend(
    _colorScale,
    {tickFormat: ".0f", title: absoluteUnit ? "Billion dollars" : "% of GDP"})
  legendContainer.appendChild(legend)
}

// Default value
let costDict = calculateCostDict("Learning (investment cost drop because of learning)_30_50% solar, 50% wind_Net Zero 2050 (NGFS global scenario)", "2.8% (WACC)", yearEndDefaultValue)
let colorScale = calculateColorScale(costDict)
setLegend(colorScale, true)

const svg = d3.select("#map")
const path = d3.geoPath().projection(d3.geoMercator().scale(170).translate([600, 300]))

const getCost = (alpha2) => {
  if (!alpha2) {
    return 0.0
  }
  return costDict[alpha2] || null
}

const fillCost = (absoluteUnit, yearEnd = yearEndDefaultValue) => (d) => {
  const alpha2 = isoNumber2Alpha2[d.id] || null
  let cost = getCost(alpha2)
  let unit
  if (absoluteUnit) {
    unit = " billion USD"
  } else {
    unit = " %"
    // Division by 1e9 converts to billion
    const denominator = gdpMarketcap2020[alpha2] / 1e9 * arbitragePeriod(yearEnd)
    cost = denominator ? cost / denominator * 100 : "N/A"
  }
  if (cost === "N/A")
    d.costText = "No GDP data"
  else {
    d.costText = (cost ? cost.toFixed(2) : 0.0) + unit
  }

  return colorScale(cost || 0.0)
}

export const calculate = () => {
  const _get = (id) => document.getElementById(id).value
  const phaseoutScenario = _get("phaseout-scenario")
  const coalReplacement = _get("coal-replacement")
  const lifetime = _get("lifetime-renewable-plants")
  const learningCurve = _get("learning-curve")
  const discountRate = _get("discount-rate")
  const yearEnd = parseInt(_get("time-horizon"))
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, phaseoutScenario].join("_")
  costDict = calculateCostDict(key, discountRate, yearEnd)
  colorScale = calculateColorScale(costDict)

  const unit = _get("requisite-climate-financing-unit")
  const absoluteUnit = unit === "Billion dollars"

  setLegend(colorScale, absoluteUnit)

  // Recompute color
  svg.selectAll("path")
    .join("path")
    .attr("fill", fillCost(absoluteUnit, yearEnd))
}

;(async () => {
  try {
    // Data taken from https://github.com/topojson/world-atlas
    const world = await d3.json("public/countries-110m.json")

    // Name hover
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)

    const mouseOver = (event, d) => {
      tooltip.transition()
        .duration(200)
        .style("opacity", .9)
      const hoverText = d.properties.name + "<br/>" + d.costText
      tooltip.html(hoverText)
        .style("left", (event.pageX) + "px")
        .style("top", (event.pageY - 28) + "px")
    }

    const mouseLeave = (event, d) => {
      tooltip.style("opacity", 0)
    }

    //allCountries
    const geoObj = topojson.feature(world, world.objects.countries)
    svg.append("g")
      .selectAll("path")
      // Filter out 010 (Antarctica)
      .data(geoObj.features.filter(d => d.id !== "010"))
      .enter()
      .append("path")
      .attr("d", path)  // draw each country
      // set the color of each country
      .attr("fill", fillCost(true))
      .style("opacity", .8)
      .style("stroke", "#d9edf7")
      .attr("class", "country")
      .on("mouseover", mouseOver )
      .on("mouseleave", mouseLeave )
  } catch (error) {
    throw error
  }
})()
