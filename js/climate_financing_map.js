// Based on https://d3-graph-gallery.com/graph/choropleth_hover_effect.html

// This is the data
import {sensitivityAnalysisResult} from "./website_sensitivity_climate_financing.js"

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

const calculateCostDict = (key) => {
  const yearlyCostsDict = sensitivityAnalysisResult[key]
  const costDict = {}
  for (const [key, value] of Object.entries(yearlyCostsDict)) {
    // Multiplication by 1e3 converts trillion dollars to billion dollars
    const summed = value.reduce((a, b) => a + b, 0) * 1e3
    costDict[key] = summed
  }
  return costDict
}

// Default value
let costDict = calculateCostDict("Learning (investment cost drop because of learning)_30_50% solar, 50% wind_2.8% (WACC)_Net Zero 2050 (NGFS global scenario)")


const svg = d3.select("#map")
const path = d3.geoPath().projection(d3.geoMercator())
const colorScale = d3.scaleThreshold()
  .domain(linspace(getMin(costDict), getMax(costDict), 6))
  .range(d3.schemeBlues[7])

const getCost = (isoNumber) => {
  const alpha2 = isoNumber2Alpha2[isoNumber] || null
  if (!alpha2) {
    return 0.0
  }
  return costDict[alpha2] || null
}

export const calculate = () => {
  const _get = (id) => document.getElementById(id).value
  const phaseoutScenario = _get("phaseout-scenario")
  const coalReplacement = _get("coal-replacement")
  const lifetime = _get("lifetime-renewable-plants")
  const learningCurve = _get("learning-curve")
  const discountRate = _get("discount-rate")
  const key = [learningCurve, lifetime.replace(" years", ""), coalReplacement, discountRate, phaseoutScenario].join("_")
  costDict = calculateCostDict(key)
  // Recompute color
  svg.selectAll("path")
    .join("path")
    .attr("fill", (d) => {
      d.cost = getCost(d.id)
      return colorScale(d.cost || 0.0)
    })
}

;(async () => {
  try {
    // Data taken from https://github.com/topojson/world-atlas
    const world = await d3.json("public/countries-110m.json")

    // Unit input
    const unitInput = document.getElementById("requisite-climate-financing-unit")
    unitInput.onchange = () => {
      const val = unitInput.value
    }

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
      tooltip.html(d.properties.name + "<br/>" + (d.cost ? d.cost.toFixed(2) + " billion USD" : "N/A"))
        .style("left", (event.pageX) + "px")
        .style("top", (event.pageY - 28) + "px")
    }

    const mouseLeave = (event, d) => {
      tooltip.style("opacity", 0)
    }

    //allCountries
    svg.append("g")
      .selectAll("path")
      .data(topojson.feature(world, world.objects.countries).features)
      .enter()
      .append("path")
      .attr("d", path)  // draw each country
      // set the color of each country
      .attr("fill", (d) => {
        d.cost = getCost(d.id)
        return colorScale(d.cost || 0.0)
      })
      .style("opacity", .8)
      .style("stroke", "#d9edf7")
      .attr("class", "country")
      .on("mouseover", mouseOver )
      .on("mouseleave", mouseLeave )
  } catch (error) {
    throw error
  }
})()
