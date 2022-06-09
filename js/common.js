import {gdpMarketcap2020} from "./all_countries_gdp_marketcap_2020_data.js"
import {levelDevelopmentMap, byRegionMap} from "./countries_grouping.js"

export const NGFS_PEG_YEAR = 2023

export const sum = (arr) => {
  let out = 0.0
  for (const e of arr) {
    out += e
  }
  return out
}

export const calculateDiscountedSum = (arr, discountRate, yearStart) => {
  let out = 0.0
  let year = yearStart
  for (const ee of arr) {
    const deltat = year - 2022
    const val = ee * ((1 + discountRate) ** -deltat)
    out += val
    year += 1
  }
  return out
}

export const _get_year_range_cost = (discountRate, yearlyCostsDict, year_start, year_end, included_countries = null) => {
  let out = 0.0
  for (const [c, e] of Object.entries(yearlyCostsDict)) {
    if (included_countries && !included_countries.has(c)) {
      continue
    }
    out += calculateDiscountedSum(
      e.slice(year_start - 2022, year_end + 1 - 2022),
      discountRate,
      year_start
    )
  }
  return out
}

export const discountRateMap = {
  "0%": 0.0,
  "2.8% (WACC)": 0.02795381840850683,
  "3.6% (WACC, average risk-premium 100 years)": 0.036227985389412014,
  "5%": 0.05,
  "8%": 0.08,
}

export const calculateGdpByRegionMap = () => {
  const getGdpSum = (countries) => {
    let gdpSum = 0.0
    for (const country of countries) {
      gdpSum += gdpMarketcap2020[country] || 0.0
    }
    return gdpSum
  }
  const gdpMap = {}
  let worldGdp = 0.0
  for (const [k, v] of Object.entries(levelDevelopmentMap)) {
    const gdpSum = getGdpSum(v)
    gdpMap[k] = gdpSum
    worldGdp += getGdpSum(v)
  }
  gdpMap["World"] = worldGdp

  for (const [k, v] of Object.entries(byRegionMap)) {
    gdpMap[k] = getGdpSum(v)
  }
  return gdpMap
}
