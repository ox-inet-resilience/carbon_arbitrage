// Based on https://d3-graph-gallery.com/graph/choropleth_hover_effect.html

// This is the data
import {sensitivityAnalysisResult} from "./coal_worker_sensitivity_analysis.js"
import {sensitivityAnalysisResultPhaseOut} from "./website_sensitivity_opportunity_costs_phase_out.js"
import {Legend} from "./d3-color-legend.js"
import {iso3166} from "./iso-3166-data.js"
import {calculateDiscountedSum, discountRateMap, NGFS_PEG_YEAR} from "./common.js"

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

const getPhaseOut = (phaseOut, countryName, discountRateText) => {
  // phaseOut unit is in billion dollars
  const timeSeries = phaseOut[countryName]
  if (!timeSeries) {
    return 0.0
  }
  const discountRate = discountRateMap[discountRateText]
  const yearStart = 2022
  const yearEnd = 2100
  return calculateDiscountedSum(timeSeries.slice(yearStart - 2022, yearEnd - 2022 + 1), discountRate, yearStart)
}

const calculateCostDict = (discountRateText, ocType) => {
  const phaseOut = sensitivityAnalysisResultPhaseOut[discountRateText]
  const data = sensitivityAnalysisResult[discountRateText]
  const lostWageObj = data["compensation workers for lost wages"]
  const retrainCostObj = data["retraining costs"]

  const costDict = {}

  for (const key of Object.keys(lostWageObj)) {
    let value
    switch (ocType) {
      case "Compensation missed cash flows of coal companies":
        value = getPhaseOut(phaseOut, key, discountRateText)
        break
      case "Compensation lost wages of coal workers":
        value = lostWageObj[key]
        break
      case "Compensation retraining costs":
        value = retrainCostObj[key]
        break
      case "All of the above":
        value = getPhaseOut(phaseOut, key, discountRateText) + (lostWageObj[key] || 0.0) + (retrainCostObj[key] || 0.0)
        break
    }
    costDict[key] = value
  }
  return costDict
}

const calculateColorScale = (_costDict) => d3.scaleThreshold()
  .domain(linspace(getMin(_costDict), getMax(_costDict), 4))
  .range(d3.schemeBlues[5])

const setLegend = (_colorScale) => {
  const legendContainer = document.getElementById("legend")
  if (legendContainer.firstChild) {
    legendContainer.removeChild(legendContainer.firstChild)
  }
  const legend = Legend(
    _colorScale,
    {
      tickFormat: ".0f",
      title: "Billion dollars"
    })
  legendContainer.appendChild(legend)
}

const makeDownloadableData = (costDict, discountRate) => {
  const jsonData = JSON.stringify(costDict)
  document.getElementById("result-data").innerHTML = jsonData
  const downloadElement = document.getElementById("download-result-data")
  downloadElement.href = "data:x-application/xml;charset=utf-8," + escape(jsonData)
  downloadElement.download = `opportunity_costs_map_${discountRate}.json`
}

// Default value
let costDict = calculateCostDict("2.8% (WACC)", "Compensation missed cash flows of coal companies")
let colorScale = calculateColorScale(costDict)
setLegend(colorScale)
makeDownloadableData(costDict, "2.8% (WACC)")

// Will have the value of 1200 when the screen width is 1280
let width = window.screen.availWidth * 0.9375
if (window.screen.availWidth < 1200) {
  // Double the size when the screen size is small.
  width *= 2
}
const screenScale = width / 1200
const svg = d3.select("#map")
svg.style("width", width + "px")
svg.style("height", width * 5 / 12 + "px")

const path = d3.geoPath().projection(d3.geoMercator().scale(170 * screenScale).translate([600 * screenScale, 300 * screenScale]))

const getCost = (alpha2) => {
  if (!alpha2) {
    return 0.0
  }
  return costDict[alpha2] || null
}

const fillCost = (d) => {
  const alpha2 = isoNumber2Alpha2[d.id] || null
  const cost = getCost(alpha2)
  const unit = " billion USD"
  if (cost === "N/A")
    d.costText = "N/A"
  else {
    d.costText = (cost ? cost.toFixed(2) : 0.0) + unit
  }

  return colorScale(cost || 0.0)
}

export const calculate = () => {
  const _get = (id) => document.getElementById(id).value
  const discountRate = _get("discount-rate")
  const ocType = _get("opportunity-costs-type")

  costDict = calculateCostDict(discountRate, ocType)
  colorScale = calculateColorScale(costDict)
  setLegend(colorScale)

  // Show raw data that can be copied/downloaded
  makeDownloadableData(costDict, discountRate)

  // Recompute color
  svg.selectAll("path")
    .join("path")
    .attr("fill", fillCost)
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
      .attr("fill", fillCost)
      .style("opacity", .8)
      .style("stroke", "#d9edf7")
      .attr("class", "country")
      .on("mouseover", mouseOver )
      .on("mouseleave", mouseLeave )
  } catch (error) {
    throw error
  }
})()
