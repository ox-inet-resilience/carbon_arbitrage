"""Replicates the climate financing bar chart of js/climate_financing.js,
split into 2 panels (by level of development, by region) in the style of
the Nature-figure reference: horizontal stacked bars, one sequential hue
ramp per panel, totals direct-labelled at the end of each bar.

A second row adds the annual (non-discounted) time series of
js/climate_financing_yearly.js, one line per group, with the same column
split as the bar charts.

A third row ports make_climate_financing_SCATTER_plot() of
../great_carbon_arbitrage/analysis_main.py: one point per country, climate
financing as a percentage of its GDP against its GDP per capita, split into
the same two columns. Its y axis is the same present value as row one, just
divided by GDP instead of summed over a group, so the whole figure stays on
one scenario and one set of numbers.

A fourth row, spanning both columns, ports the left subplot of
make_yearly_climate_financing_plot_SENSITIVITY_ANALYSIS() of the same file:
the world annual (non-discounted) series of row two, redrawn once per
alternative assumption. The variants are read straight out of the sensitivity
JSON the website already ships, so this row needs no extra input; that also
bounds it to the two dimensions the JSON varies (renewable lifetime and the
learning curve). The "lifetime by level of development" and "LCOE proxy"
lines of the original have no counterpart on the website and are left out.

The country groupings and the GDP series are read by evaluating the js/
modules with node, so they cannot drift from the website.

Requires node on PATH.

Usage:
    python for_nature_paper_2026/plot_climate_financing_barchart.py
"""

import json
import math
import subprocess
from pathlib import Path

import matplotlib.pyplot as plt

# This script lives one directory down, so every path below stays anchored to
# the repository root and the script runs from any working directory.
REPO = Path(__file__).resolve().parent.parent
DATA_PATH = REPO / "js" / "website_sensitivity_climate_financing.json"
COAL_EXPORT_DATA_PATH = (
    REPO / "public" / "website_sensitivity_climate_financing_coal_export_over_battery.json"
)
GROUPING_PATH = REPO / "js" / "countries_grouping.js"
GDP_MARKETCAP_PATH = REPO / "js" / "all_countries_gdp_marketcap_2020_data.js"
# The one input the website does not carry, copied from
# ../great_carbon_arbitrage/data/ (the x axis of the scatter row).
GDP_PER_CAPITA_PATH = REPO / "data" / "all_countries_gdp_per_capita_2020.json"

# ---------------------------------------------------------------- constants
# Mirrors js/common.js
NGFS_PEG_YEAR = 2023
DATA_START_YEAR = 2022

DISCOUNT_RATE_MAP = {
    "0%": 0.0,
    "2.8% (WACC)": 0.02795381840850683,
    "3.6% (WACC, average risk-premium 100 years)": 0.036227985389412014,
    "5%": 0.05,
    "8%": 0.08,
}

YEAR_START_ENDS = [(NGFS_PEG_YEAR + 1, 2030), (2031, 2050), (2051, 2070), (2071, 2100)]

# Mirrors wholeYears in js/climate_financing_yearly.js
WHOLE_YEARS = list(range(DATA_START_YEAR, 2100 + 1))

# The key layout is built in js/climate_financing.js:
# learningCurve_lifetime_coalReplacement_energyStorage
LEARNING = "Learning (investment cost drop because of learning)"
NO_LEARNING = "No learning (no investment cost drop)"
DEFAULT_LIFETIME = "30"  # years
DEFAULT_COAL_REPLACEMENT = "50% solar, 25% wind onshore, 25% wind offshore"
DEFAULT_ENERGY_STORAGE = "Short-term + long-term storage"


def sensitivity_key(
    learning_curve=LEARNING,
    lifetime=DEFAULT_LIFETIME,
    coal_replacement=DEFAULT_COAL_REPLACEMENT,
    energy_storage=DEFAULT_ENERGY_STORAGE,
):
    return "_".join([learning_curve, lifetime, coal_replacement, energy_storage])


# The scenario shown in barchart.png, i.e. the page defaults declared in
# includes/common_user_inputs.pug and includes/mixins.pug.
DEFAULT_KEY = sensitivity_key()
DEFAULT_DISCOUNT_RATE = "2.8% (WACC)"

# Row four: (label, key, linestyle), the default drawn solid and every
# deviation from it dotted, as in the original. These are the only two
# dimensions of the sensitivity JSON that the original also varies; appending
# e.g. sensitivity_key(energy_storage="Not included") adds a further line.
SENSITIVITY_VARIANTS = [
    ("30Y, learning", sensitivity_key(), "-"),
    ("30Y, no learning", sensitivity_key(learning_curve=NO_LEARNING), "dotted"),
    ("50Y, learning", sensitivity_key(lifetime="50"), "dotted"),
    (
        "50Y, no learning",
        sensitivity_key(learning_curve=NO_LEARNING, lifetime="50"),
        "dotted",
    ),
]


# ------------------------------------------------------- groupings from JS
# Evaluate the actual ES module with node, rather than re-declaring the
# country lists here, so the two can never disagree. The Sets it exports are
# not JSON-serialisable, hence the spread into arrays.
GROUPING_EXPORT_SCRIPT = """
const m = await import(%s);
const toArrays = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, [...v]]));
console.log(JSON.stringify({
  levelDevelopmentMap: toArrays(m.levelDevelopmentMap),
  byRegionMap: toArrays(m.byRegionMap),
}));
"""


# The GDP series is a plain object, but it holds bare NaNs for the countries
# the World Bank does not cover; JSON.stringify turns those into null.
GDP_EXPORT_SCRIPT = """
const m = await import(%s);
console.log(JSON.stringify(m.gdpMarketcap2020));
"""


def run_node(script, path):
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        capture_output=True,
        text=True,
        cwd=path.parent,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"node failed reading {path}:\n{proc.stderr}")
    return json.loads(proc.stdout)


def load_groupings(path=GROUPING_PATH):
    """Return (levelDevelopmentMap, byRegionMap) as {group_name: set_of_iso2}."""
    script = GROUPING_EXPORT_SCRIPT % json.dumps(path.resolve().as_uri())
    parsed = run_node(script, path)
    return (
        {k: set(v) for k, v in parsed["levelDevelopmentMap"].items()},
        {k: set(v) for k, v in parsed["byRegionMap"].items()},
    )


def load_gdp_marketcap(path=GDP_MARKETCAP_PATH):
    """2020 GDP in dollars, {iso2: value}, without the uncovered countries."""
    script = GDP_EXPORT_SCRIPT % json.dumps(path.resolve().as_uri())
    return {k: v for k, v in run_node(script, path).items() if v is not None}


def load_gdp_per_capita(path=GDP_PER_CAPITA_PATH):
    with open(path) as f:
        # json.loads accepts the bare NaN token that the World Bank export uses.
        return {k: v for k, v in json.load(f).items() if not math.isnan(v)}


LEVEL_DEVELOPMENT_MAP, BY_REGION_MAP = load_groupings()


# ------------------------------------------------------------------ compute
def calculate_discounted_sum(values, discount_rate, year_start):
    """Mirrors calculateDiscountedSum in js/common.js."""
    out = 0.0
    for i, value in enumerate(values):
        deltat = year_start + i - DATA_START_YEAR
        out += value * ((1 + discount_rate) ** -deltat)
    return out


def get_year_range_cost(
    discount_rate, yearly_costs_dict, year_start, year_end, included_countries=None
):
    """Mirrors _get_year_range_cost in js/common.js.

    Values in the JSON are already in trillion dollars.
    """
    out = 0.0
    for country, yearly in yearly_costs_dict.items():
        if included_countries is not None and country not in included_countries:
            continue
        out += calculate_discounted_sum(
            yearly[year_start - DATA_START_YEAR : year_end + 1 - DATA_START_YEAR],
            discount_rate,
            year_start,
        )
    return out


def calculate_plot_data(yearly_costs_dict, discount_rate_text):
    """Present value of climate financing (trillion dollars) per group per period.

    Returns {group_name: {period_label: value}} covering both groupings.
    """
    discount_rate = DISCOUNT_RATE_MAP[discount_rate_text]

    groups = {"World": None}  # None => every country in the dataset
    groups.update(LEVEL_DEVELOPMENT_MAP)
    groups.update(BY_REGION_MAP)

    return {
        group: {
            f"{year_start}-{year_end}": get_year_range_cost(
                discount_rate, yearly_costs_dict, year_start, year_end, countries
            )
            for year_start, year_end in YEAR_START_ENDS
        }
        for group, countries in groups.items()
    }


def get_yearly_cost(yearly_costs_dict, included_countries=None):
    """Mirrors _get_yearly_cost in js/climate_financing_yearly.js.

    Returns one value per year in WHOLE_YEARS, in trillion dollars,
    non-discounted.
    """
    out = [0.0] * len(WHOLE_YEARS)
    for country, yearly in yearly_costs_dict.items():
        if included_countries is not None and country not in included_countries:
            continue
        for i, value in enumerate(yearly):
            out[i] += value
    return out


def calculate_yearly_plot_data(yearly_costs_dict):
    """Annual climate financing (billion dollars) per group per year.

    Returns {group_name: [value_per_year]} covering both groupings.
    """
    groups = {"World": None}  # None => every country in the dataset
    groups.update(LEVEL_DEVELOPMENT_MAP)
    groups.update(BY_REGION_MAP)

    return {
        # Multiplication by 1e3 converts trillion to billion dollars
        group: [v * 1e3 for v in get_yearly_cost(yearly_costs_dict, countries)]
        for group, countries in groups.items()
    }


def calculate_sensitivity_yearly_plot_data(data):
    """World annual climate financing (billion dollars) per sensitivity variant.

    Mirrors calculate_yearly_world_cost() in the left subplot of
    make_yearly_climate_financing_plot_SENSITIVITY_ANALYSIS(). Takes the whole
    sensitivity JSON rather than one scenario out of it, since the point of the
    panel is to compare scenarios.

    Returns {variant_label: [value_per_year]}.
    """
    out = {}
    for label, key, _ in SENSITIVITY_VARIANTS:
        if key not in data:
            raise KeyError(f"{key!r} not in the sensitivity data")
        # Multiplication by 1e3 converts trillion to billion dollars, so the
        # panel shares its unit with the time-series row above.
        out[label] = [v * 1e3 for v in get_yearly_cost(data[key])]
    return out


def calculate_scatter_data(yearly_costs_dict, discount_rate_text):
    """Mirrors plot_scatter() in analysis_main.py with divide_by_marketcap.

    Returns {iso2: (gdp per capita in dollars, climate financing as a
    percentage of that country's GDP over the arbitrage period)}, over the
    whole horizon covered by the bars above.
    """
    discount_rate = DISCOUNT_RATE_MAP[discount_rate_text]
    year_start = YEAR_START_ENDS[0][0]
    year_end = YEAR_START_ENDS[-1][1]
    arbitrage_period = 1 + (year_end - year_start)

    gdp_marketcap = load_gdp_marketcap()
    gdp_per_capita = load_gdp_per_capita()

    out = {}
    for country, yearly in yearly_costs_dict.items():
        if country in SCATTER_SKIP_COUNTRIES:
            continue
        if country not in gdp_marketcap or country not in gdp_per_capita:
            continue
        # x1e12 converts the trillion dollars of the JSON to dollars, so the
        # ratio to GDP is dimensionless before the x100.
        pv = calculate_discounted_sum(
            yearly[year_start - DATA_START_YEAR : year_end + 1 - DATA_START_YEAR],
            discount_rate,
            year_start,
        )
        percentage = pv * 1e12 / (gdp_marketcap[country] * arbitrage_period) * 100
        out[country] = (gdp_per_capita[country], percentage)
    return out


# ----------------------------------------------------------------- plotting
PERIODS = [f"{s}-{e}" for s, e in YEAR_START_ENDS]

# Sequential ramps, light -> dark: the periods are ordered, so one hue per
# panel encodes them; the two panels are told apart by hue family, as in the
# reference figure.
BLUES = ["#DCE9F6", "#A6C9E4", "#5A9BCB", "#1F5F96"]
WARMS = ["#FBE3A6", "#F7B54A", "#EF7C2B", "#D6331F"]

# Line colours for the time-series row. Same hue family as the bars above
# them, but categorical rather than sequential: the groups are not ordered,
# so the shades are picked to stay distinguishable at line width.
BLUE_LINES = ["#1a1a1a", "#1F5F96", "#5A9BCB", "#8FC0DE"]
WARM_LINES = ["#D6331F", "#EF7C2B", "#F0B429", "#9C6B1E", "#B5495B", "#7A4B8C"]

# Sensitivity row: the default assumption in the black of "World" above, the
# deviations in one colour each, and told apart from the rows above by the
# dotted linestyle rather than by hue.
SENSITIVITY_LINES = ["#1a1a1a", "#1F5F96", "#D6331F", "#EF7C2B"]

BY_DEVELOPMENT = [
    "World",
    "Developed Countries",
    "Emerging Market Countries",
    "Developing Countries",
]
BY_REGION = [
    "Asia",
    "Europe",
    "North America",
    "Australia & New Zealand",
    "Africa",
    "Latin America & the Carribean",
]

# Group names wrapped for the y-axis, where the untruncated name would eat
# into the plotting area. Keys must match the group names above.
TICK_LABELS = {
    "Latin America & the Carribean": "Latin America &\nthe Carribean",
}

# The scatter row has no "World": it is one point per country. Everything else
# keeps the order and colour of the rows above, so a group is the same hue in
# all three rows.
SCATTER_BY_DEVELOPMENT = [g for g in BY_DEVELOPMENT if g != "World"]
SCATTER_BLUE_MARKERS = BLUE_LINES[1:]
# Left out of the scatter, as in plot_scatter(): neither is in the World Bank
# GDP series that the x axis comes from.
SCATTER_SKIP_COUNTRIES = {"TW", "XK"}
# A country is labelled unless it sits in the crowded bottom-left corner, as
# in analysis_main.py. Raising the y threshold thins out the labels.
SCATTER_ANNOTATE_MAX_X = 20_000
SCATTER_ANNOTATE_MAX_Y = 5

TEXT = "#1a1a1a"
MUTED = "#6b6b6b"


def draw_panel(ax, plot_data, groups, colors, title, panel_letter, xmax):
    ys = list(range(len(groups)))[::-1]  # first group at the top

    for y, group in zip(ys, groups):
        left = 0.0
        for period, color in zip(PERIODS, colors):
            value = plot_data[group][period]
            ax.barh(
                y,
                value,
                left=left,
                height=0.62,
                color=color,
                edgecolor="black",
                linewidth=1.2,  # outline the stacked segments
                zorder=3,
            )
            left += value
        # Direct-label the total at the end of the bar.
        ax.text(
            left + xmax * 0.015,
            y,
            f"{left:.1f}",
            va="center",
            ha="left",
            fontsize=9,
            color=TEXT,
        )

    ax.set_yticks(ys)
    ax.set_yticklabels(
        [TICK_LABELS.get(g, g) for g in groups], fontsize=9, color=TEXT
    )
    ax.set_xlim(0, xmax)
    ax.set_ylim(-0.7, len(groups) - 0.3)
    ax.set_xlabel(
        "Present value of climate financing (trillion dollars)",
        fontsize=9,
        color=TEXT,
    )
    ax.set_title(title, fontsize=10, color=TEXT, pad=10)
    ax.tick_params(axis="x", labelsize=9, colors=TEXT, length=3)
    ax.tick_params(axis="y", length=0, colors=TEXT)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("bottom", "left"):
        ax.spines[side].set_color(TEXT)
    # ax.xaxis.grid(True, color="#e8e8e8", linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)

    # Panel letter, in the reference's upper-left position.
    ax.text(
        -0.01, 1.10, panel_letter, transform=ax.transAxes,
        fontsize=13, fontweight="bold", va="top", ha="right", color=TEXT,
    )

    # Inline swatch legend, as in the reference figure.
    handles = [
        plt.Rectangle((0, 0), 1, 1, facecolor=c, edgecolor="black", linewidth=0.8)
        for c in colors
    ]
    ax.legend(
        handles,
        PERIODS,
        loc="lower right",
        frameon=False,
        fontsize=8,
        handlelength=1.1,
        handleheight=1.1,
        labelspacing=0.35,
        borderaxespad=0.8,
    )


def draw_timeseries_panel(
    ax,
    yearly_plot_data,
    groups,
    colors,
    panel_letter,
    ymax,
    linestyles=None,
    ylabel="Annual climate financing (billion dollars)",
):
    for i, (group, color) in enumerate(zip(groups, colors)):
        ax.plot(
            WHOLE_YEARS,
            yearly_plot_data[group],
            color=color,
            linestyle="-" if linestyles is None else linestyles[i],
            linewidth=1.6,
            label=group,
            zorder=3,
        )

    ax.set_xlim(WHOLE_YEARS[0], WHOLE_YEARS[-1])
    ax.set_ylim(0, ymax)
    ax.set_xlabel("Time", fontsize=9, color=TEXT)
    ax.set_ylabel(ylabel, fontsize=9, color=TEXT)
    ax.tick_params(axis="both", labelsize=9, colors=TEXT, length=3)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("bottom", "left"):
        ax.spines[side].set_color(TEXT)
    # ax.yaxis.grid(True, color="#e8e8e8", linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)

    ax.text(
        -0.01, 1.10, panel_letter, transform=ax.transAxes,
        fontsize=13, fontweight="bold", va="top", ha="right", color=TEXT,
    )

    ax.legend(
        loc="upper right",
        frameon=False,
        fontsize=8,
        handlelength=1.6,
        labelspacing=0.35,
        borderaxespad=0.8,
    )


def report_scatter_coverage(yearly_costs_dict, scatter_data):
    """The sanity checks that make_climate_financing_SCATTER_plot() prints.

    A country is absent from a panel when it has no GDP, no GDP per capita, or
    no group in that panel's classification.
    """
    dropped = sorted(set(yearly_costs_dict) - set(scatter_data))
    print(
        f"scatter: {len(scatter_data)} of {len(yearly_costs_dict)} countries plotted"
    )
    if dropped:
        print("scatter: no GDP or no GDP per capita:", dropped)
    for name, group_map in (
        ("by level of development", LEVEL_DEVELOPMENT_MAP),
        ("by region", BY_REGION_MAP),
    ):
        classified = set().union(*group_map.values())
        unclassified = sorted(set(scatter_data) - classified)
        if unclassified:
            print(f"scatter: not classified {name}:", unclassified)


def draw_scatter_panel(ax, scatter_data, group_map, groups, colors, panel_letter):
    for group, color in zip(groups, colors):
        countries = group_map[group]
        points = [
            (country, *scatter_data[country])
            for country in sorted(scatter_data)
            if country in countries
        ]
        ax.plot(
            [x for _, x, _ in points],
            [y for _, _, y in points],
            color=color,
            linewidth=0,
            marker="o",
            fillstyle="none",
            markersize=5,
            markeredgewidth=1.2,
            label=TICK_LABELS.get(group, group),
            zorder=3,
        )
        for country, x, y in points:
            if x <= SCATTER_ANNOTATE_MAX_X and y <= SCATTER_ANNOTATE_MAX_Y:
                continue
            ax.annotate(
                country,
                (x, y),
                textcoords="offset points",
                xytext=(0, 5),
                ha="center",
                fontsize=7,
                color=MUTED,
            )

    ax.set_xlabel("GDP per capita (dollars)", fontsize=9, color=TEXT)
    ax.set_ylabel(
        "Present value of climate financing\n(% of country GDP)",
        fontsize=9,
        color=TEXT,
    )
    ax.tick_params(axis="both", labelsize=9, colors=TEXT, length=3)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("bottom", "left"):
        ax.spines[side].set_color(TEXT)
    ax.set_axisbelow(True)

    ax.text(
        -0.01, 1.10, panel_letter, transform=ax.transAxes,
        fontsize=13, fontweight="bold", va="top", ha="right", color=TEXT,
    )

    ax.legend(
        loc="upper right",
        frameon=False,
        fontsize=8,
        handlelength=1.0,
        labelspacing=0.35,
        borderaxespad=0.8,
    )


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)
    # Swap in COAL_EXPORT_DATA_PATH for the "coal export enabled" variant.
    if DEFAULT_KEY not in data:
        raise KeyError(f"{DEFAULT_KEY!r} not in {DATA_PATH}; have: {sorted(data)[:5]}")
    yearly_costs_dict = data[DEFAULT_KEY]

    plot_data = calculate_plot_data(yearly_costs_dict, DEFAULT_DISCOUNT_RATE)
    yearly_plot_data = calculate_yearly_plot_data(yearly_costs_dict)
    scatter_data = calculate_scatter_data(yearly_costs_dict, DEFAULT_DISCOUNT_RATE)
    report_scatter_coverage(yearly_costs_dict, scatter_data)
    sensitivity_plot_data = calculate_sensitivity_yearly_plot_data(data)

    totals = [sum(plot_data[g].values()) for g in BY_DEVELOPMENT + BY_REGION]
    xmax = max(totals) * 1.15  # shared scale, so the two panels stay comparable
    peaks = [max(yearly_plot_data[g]) for g in BY_DEVELOPMENT + BY_REGION]
    ymax = max(peaks) * 1.15
    # The sensitivity row gets its own scale: the no-learning variants run well
    # above the World line of row two.
    sensitivity_ymax = max(max(v) for v in sensitivity_plot_data.values()) * 1.15

    # The last row is one panel spanning both columns, so it needs a gridspec
    # rather than a plain subplots() grid.
    fig = plt.figure(figsize=(12, 16.8), constrained_layout=True)
    gs = fig.add_gridspec(4, 2)
    ax_a, ax_b = fig.add_subplot(gs[0, 0]), fig.add_subplot(gs[0, 1])
    ax_c, ax_d = fig.add_subplot(gs[1, 0]), fig.add_subplot(gs[1, 1])
    ax_e, ax_f = fig.add_subplot(gs[2, 0]), fig.add_subplot(gs[2, 1])
    ax_g = fig.add_subplot(gs[3, :])
    draw_panel(ax_a, plot_data, BY_DEVELOPMENT, BLUES,
               "By level of development", "a", xmax)
    draw_panel(ax_b, plot_data, BY_REGION, WARMS, "By region", "b", xmax)
    draw_timeseries_panel(ax_c, yearly_plot_data, BY_DEVELOPMENT, BLUE_LINES,
                          "c", ymax)
    draw_timeseries_panel(ax_d, yearly_plot_data, BY_REGION, WARM_LINES,
                          "d", ymax)
    draw_scatter_panel(ax_e, scatter_data, LEVEL_DEVELOPMENT_MAP,
                       SCATTER_BY_DEVELOPMENT, SCATTER_BLUE_MARKERS, "e")
    draw_scatter_panel(ax_f, scatter_data, BY_REGION_MAP, BY_REGION,
                       WARM_LINES, "f")
    draw_timeseries_panel(
        ax_g,
        sensitivity_plot_data,
        [label for label, _, _ in SENSITIVITY_VARIANTS],
        SENSITIVITY_LINES,
        "g",
        sensitivity_ymax,
        linestyles=[linestyle for _, _, linestyle in SENSITIVITY_VARIANTS],
        ylabel="Global annual climate financing\n(billion dollars)",
    )
    # The two scatters show the same points, so keep them on one scale.
    for ax in (ax_e, ax_f):
        ax.set_xlim(ax_e.get_xlim())
        ax.set_ylim(ax_e.get_ylim())

    fig.savefig(REPO / "barchart_split.png", dpi=200, bbox_inches="tight",
                facecolor="white")
    print(f"Wrote {REPO / 'barchart_split.png'}")


if __name__ == "__main__":
    main()
