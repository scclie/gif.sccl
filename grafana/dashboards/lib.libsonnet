local g = import 'github.com/grafana/grafonnet/gen/grafonnet-v13.0.0/main.libsonnet';

local ds = '${DS_PROMETHEUS}';

{
  grafana: g,
  datasource: ds,

  dashboard(title, uid, panels)::
    g.dashboard.new(title)
    + g.dashboard.withUid(uid)
    + g.dashboard.withRefresh('30s')
    + g.dashboard.withVariables([
      {
        name: 'DS_PROMETHEUS',
        label: 'datasource',
        type: 'datasource',
        query: 'prometheus',
        hide: 0,
        current: { text: 'Prometheus', value: 'Prometheus' },
      },
    ])
    + g.dashboard.graphTooltip.withSharedCrosshair()
    + g.dashboard.withPanels(panels),

  ts(title, expr, legend, unit, w, h, x, y)::
    g.panel.timeSeries.new(title)
    + g.panel.timeSeries.queryOptions.withTargets([
      g.query.prometheus.new(ds, expr)
      + g.query.prometheus.withLegendFormat(legend)
      + g.query.prometheus.withRefId('A'),
    ])
    + g.panel.timeSeries.standardOptions.withUnit(unit)
    + g.panel.timeSeries.gridPos.withX(x)
    + g.panel.timeSeries.gridPos.withY(y)
    + g.panel.timeSeries.gridPos.withW(w)
    + g.panel.timeSeries.gridPos.withH(h),

  stat(title, expr, unit, w, h, x, y)::
    g.panel.stat.new(title)
    + g.panel.stat.queryOptions.withTargets([
      g.query.prometheus.new(ds, expr)
      + g.query.prometheus.withRefId('A'),
    ])
    + g.panel.stat.standardOptions.withUnit(unit)
    + g.panel.stat.gridPos.withX(x)
    + g.panel.stat.gridPos.withY(y)
    + g.panel.stat.gridPos.withW(w)
    + g.panel.stat.gridPos.withH(h),

  bar(title, expr, legend, w, h, x, y)::
    g.panel.barChart.new(title)
    + g.panel.barChart.queryOptions.withTargets([
      g.query.prometheus.new(ds, expr)
      + g.query.prometheus.withLegendFormat(legend)
      + g.query.prometheus.withRefId('A'),
    ])
    + g.panel.barChart.gridPos.withX(x)
    + g.panel.barChart.gridPos.withY(y)
    + g.panel.barChart.gridPos.withW(w)
    + g.panel.barChart.gridPos.withH(h),
}