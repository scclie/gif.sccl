local lib = import 'lib.libsonnet';

local gif = '{job="gif-app"}';

local dash = {
  title: 'gif.sccl metrics',
  uid: 'gif-sccl-metrics',

panels: [
    lib.ts(
      title='API requests by route', unit='short',
      expr='sum by (route) (increase(gif_http_requests_total' + gif + '[$__rate_interval]))',
      legend='{{route}}',
      w=24, h=8, x=0, y=0,
    ),
    lib.ts(
      title='Deletes', unit='short',
      expr='sum(increase(gif_delete_total' + gif + '[$__rate_interval]))',
      legend='deletes',
      w=8, h=8, x=0, y=8,
    ),
    lib.bar(
      title='Errors by type',
      expr='sum by (type) (increase(gif_errors_total' + gif + '[$__range]))',
      legend='{{type}}',
      w=8, h=8, x=8, y=8,
    ),
    lib.stat(
      title='Active users', expr='gif_users_active' + gif, unit='short',
      w=8, h=8, x=16, y=8,
    ),
    lib.ts(
      title='GIFs in DB',
      expr='sum by (format, vis) (gif_gifs_total' + gif + ')',
      legend='{{format}}/{{vis}}',
      unit='short',
      w=12, h=8, x=0, y=16,
    ),
    lib.stat(
      title='Target up', expr='up' + gif, unit='percentunit',
      w=12, h=8, x=12, y=16,
    ),
    lib.stat(
      title='Storage used',
      expr='sum(gif_storage_bytes' + gif + ')', unit='bytes',
      w=12, h=8, x=0, y=24,
    ),
    lib.stat(
      title='Total GIFs',
      expr='sum(gif_gifs_total' + gif + ')', unit='short',
      w=12, h=8, x=12, y=24,
    ),
  ],
};

lib.dashboard(dash.title, dash.uid, dash.panels)
