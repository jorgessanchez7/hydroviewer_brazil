import requests
import os
import io
import concurrent.futures
import pandas as pd
import numpy as np
import datetime as dt
from requests.packages.urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

WORKSPACE_DIR = '../workspaces/app_workspace'

def get_warning_points(api_source, watershed, workspace):
  brazil_id_path = os.path.join(workspace, 'brazil_reachids.csv')
  reach_pds = pd.read_csv(brazil_id_path)
  reach_ids_list = reach_pds['COMID'].tolist()
  return_obj = {}

  try:
    res = requests.get(api_source + '/api/ForecastWarnings/?region=' + watershed + '-' + 'geoglows' + '&return_format=csv', verify=False).content
    res_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)
    cols = [
      'date_exceeds_return_period_2',
      'date_exceeds_return_period_5',
      'date_exceeds_return_period_10',
      'date_exceeds_return_period_25',
      'date_exceeds_return_period_50',
      'date_exceeds_return_period_100',
    ]

    res_df["rp_all"] = res_df[cols].apply(lambda x: ','.join(x.replace(np.nan, '0')), axis=1)

    test_list = res_df["rp_all"].tolist()

    final_new_rp = []
    for term in test_list:
      new_rp = []
      terms = term.split(',')
      for te in terms:
        if te != '0':
          new_rp.append(1)
        else:
          new_rp.append(0)
      final_new_rp.append(new_rp)

    res_df['rp_all2'] = final_new_rp

    res_df = res_df.reset_index()
    res_df = res_df[res_df['comid'].isin(reach_ids_list)]

    d = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
        'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist()}
    df_final = pd.DataFrame(data=d)

    df_final[['rp_2', 'rp_5', 'rp_10', 'rp_25', 'rp_50', 'rp_100']] = pd.DataFrame(res_df.rp_all2.tolist(),
                                              index=df_final.index)
    d2 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
        'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(), 'rp': df_final['rp_2']}
    d5 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
        'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(), 'rp': df_final['rp_5']}
    d10 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
          'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(), 'rp': df_final['rp_10']}
    d25 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
          'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(), 'rp': df_final['rp_25']}
    d50 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
          'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(), 'rp': df_final['rp_50']}
    d100 = {'comid': res_df['comid'].tolist(), 'stream_order': res_df['stream_order'].tolist(),
        'lat': res_df['stream_lat'].tolist(), 'lon': res_df['stream_lon'].tolist(),
        'rp': df_final['rp_100']}

    df_final_2 = pd.DataFrame(data=d2)
    df_final_2 = df_final_2[df_final_2['rp'] > 0]
    df_final_5 = pd.DataFrame(data=d5)
    df_final_5 = df_final_5[df_final_5['rp'] > 0]
    df_final_10 = pd.DataFrame(data=d10)
    df_final_10 = df_final_10[df_final_10['rp'] > 0]
    df_final_25 = pd.DataFrame(data=d25)
    df_final_25 = df_final_25[df_final_25['rp'] > 0]
    df_final_50 = pd.DataFrame(data=d50)
    df_final_50 = df_final_50[df_final_50['rp'] > 0]
    df_final_100 = pd.DataFrame(data=d100)
    df_final_100 = df_final_100[df_final_100['rp'] > 0]

    return_obj['warning2'] = create_rp(df_final_2)
    return_obj['warning5'] = create_rp(df_final_5)
    return_obj['warning10'] = create_rp(df_final_10)
    return_obj['warning25'] = create_rp(df_final_25)
    return_obj['warning50'] = create_rp(df_final_50)
    return_obj['warning100'] = create_rp(df_final_100)

    return return_obj
  except Exception as e:
    print(str(e))
    return {'error': 'No data found for the selected reach.'}

def create_rp(df_):
  war = {}

  list_coordinates = []
  for lat, lon, comid in zip(df_['lat'].tolist(), df_['lon'].tolist(), df_['comid'].tolist()):
    list_coordinates.append([lat, lon, int(comid)])

  return list_coordinates

def chunks(lst, n):
  """Yield successive n-sized chunks from lst."""
  for i in range(0, len(lst), n):
    yield lst[i:i + n]

def get_request(url):
  return requests.get(url, verify=False).content

def request_comid_info(api_source, comid, workspace, watershed, start, end):
  cache_stats_path = os.path.join(workspace, f'stats_{ watershed }.csv')
  stats_df = pd.read_csv(cache_stats_path, index_col=0) if os.path.exists(cache_stats_path) else pd.DataFrame()
  stats_df = stats_df[stats_df.comid == comid]

  cache_periods_path = os.path.join(workspace, f'periods_{ watershed }.csv')
  periods_df = pd.read_csv(cache_periods_path, index_col=0) if os.path.exists(cache_periods_path) else pd.DataFrame()
  periods_df = periods_df[periods_df.index == comid]

  if stats_df.empty:
    res = get_request(api_source + '/api/ForecastStats/?reach_id=' + str(comid) + '&return_format=csv')
    stats_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

  if periods_df.empty:
    res = get_request(api_source + '/api/ReturnPeriods/?reach_id=' + str(comid) + '&return_format=csv')
    periods_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

  date_start = dt.date.today() + dt.timedelta(days=start)
  date_start_str = date_start.strftime("%Y-%m-%d")
  date_limit = date_start + dt.timedelta(days=end)
  date_limit_str = date_limit.strftime("%Y-%m-%d")

  stats_df.index = pd.to_datetime(stats_df.index)
  stats_df[stats_df < 0] = 0
  stats_df.index = stats_df.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
  stats_df = stats_df[stats_df.index >= date_start_str]
  stats_df = stats_df[stats_df.index < date_limit_str]
  stats_df.index = pd.to_datetime(stats_df.index)

  return (stats_df, periods_df)

def comid_flow(api_source, comid, current_period, next_period, workspace, watershed, start, end):
  comid_info = request_comid_info(api_source, comid, workspace, watershed, start, end)
  stats_df = comid_info[0]
  periods_df = comid_info[1]

  flow_avg = list(stats_df['flow_avg_m^3/s'].dropna(axis=0))
  start_flow_avg = flow_avg[0]
  max_flow_avg = max(flow_avg)
  min_flow_avg = min(flow_avg)

  period_min = periods_df[current_period].values[0]
  period_max = periods_df[next_period].values[0] if next_period != None else float('inf')

  flow_status = 'same'
  
  if start_flow_avg >= period_min:
    if max_flow_avg > period_max:
      flow_status = 'up'
    elif min_flow_avg < period_min and max_flow_avg > period_min:
      flow_status = 'down'
  elif max_flow_avg > period_min:
    flow_status = 'up'  
  elif (current_period == 'return_period_2') and (min_flow_avg < period_min) and (max_flow_avg < period_min):
    flow_status = 'neutro'   

  return flow_status

def get_warning_points_data(api_source, period, points, workspace, watershed):
  print('Starting period', period)
  periods = [2, 5, 10, 25, 50, 100]
  period_index = periods.index(period)
  next_period_index = periods[period_index + 1] if period_index + 1 < len(periods) else None

  current_period = 'return_period_' + str(period)
  next_period = 'return_period_' + str(next_period_index) if next_period_index != None else None

  response = []

  def request_point_info(point):
    flow_0 = comid_flow(api_source, point[3], current_period, next_period, workspace, watershed, 0,4)
    flow_1 = comid_flow(api_source, point[3], current_period, next_period, workspace, watershed, 4,10)
    flow_2 = comid_flow(api_source, point[3], current_period, next_period, workspace, watershed, 10,16)
 
    all = [flow_0, flow_1, flow_2]
    flow = None
    flow_h = None

    if 'up' in all:
        flow_h = all.index('up')
        flow = 'up'
    else:
        flow_h = 0
        flow = all[0]

    response.append([point[0], point[1], point[2], point[3], flow, flow_h])

  for point in points.values:
    request_point_info(point)

  print('Period', period, 'done')
  return response

def get_new_warnings():
    path = os.path.join(WORKSPACE_DIR, 'RT_discharge_allstations.csv')
    cols = ['Latitude', 'Longitude', 'new_COMID', 'RT2y', 'RT5y', 'RT10y', 'RT25y', 'RT50y', 'RT100y']
    periods_wp = pd.read_csv(path, usecols=cols)
    periods_wp['rivid'] = periods_wp['new_COMID']


    new_order = ['rivid', 'RT100y', 'RT50y', 'RT25y', 'RT10y', 'RT5y', 'RT2y', 'new_COMID', 'Latitude', 'Longitude']
    periods_wp = periods_wp[new_order]

    new_column_names = {'Latitude' : 'lat', 
                'Longitude':'lon',
                'new_COMID' : 'comid', 
                'RT2y': 'return_period_2', 
                'RT5y': 'return_period_5', 
                'RT10y': 'return_period_10', 
                'RT25y': 'return_period_25', 
                'RT50y': 'return_period_50', 
                'RT100y': 'return_period_100'}

    periods_wp = periods_wp.rename(columns=new_column_names)

    cols = ['lat', 'lon', 'comid']
    df = periods_wp[cols].copy()

    periods_wp = periods_wp.drop(columns = ['lat', 'lon'])

    periods_list = [2,5,10,25,50,100]

    df_wp = df.loc[df.index.repeat(len(periods_list))].reset_index(drop=True)
    df_wp.insert(0, 'period', periods_list * len(df)) 
    df_wp.sort_values(by='period', ascending=True, inplace=True)
    df_wp.reset_index(drop=True, inplace=True)

    # reach_ids_list = reach_pds['COMID'].tolist()
    return df_wp,periods_wp

def get_all_warning_points_data(api_source, watershed, workspace=WORKSPACE_DIR, warning_points=pd.DataFrame()):
  print('has cache', not warning_points.empty)

  if warning_points.empty:
    wps = get_warning_points(api_source, watershed, workspace)
    periods = [
      [ 2, 'warning2'],
      [ 5, 'warning5' ],
      [ 10, 'warning10' ],
      [ 25, 'warning25' ],
      [ 50, 'warning50' ],
      [ 100, 'warning100' ],
    ]

    dataframes = []
    for period, key in periods:
      df = pd.DataFrame(wps[key])
      df.insert(0, 'period', period)
      df.columns = [ 'period', 'lat', 'lon', 'comid' ]

      dataframes.append(df)

    warning_points = pd.concat(dataframes)

  wps = {
    2: warning_points[warning_points.period == 2],
    5: warning_points[warning_points.period == 5],
    10: warning_points[warning_points.period == 10],
    25: warning_points[warning_points.period == 25],
    50: warning_points[warning_points.period == 50],
    100: warning_points[warning_points.period == 100],
  }

  args = ((key, wps[key]) for key in wps.keys())

  print('Gathering additional data')
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
      results = executor.map(lambda args: get_warning_points_data(api_source, *args, workspace, watershed), args)
 
  dataframes = []
  for result in results:
    df = pd.DataFrame(result, columns=['period', 'lat', 'lon', 'comid', 'flow_status', 'flow_peaks'])
    dataframes.append(df)

  result_df = pd.concat(dataframes)
  del_ids = result_df.loc[result_df['flow_status'] == 'neutro', 'comid'].tolist()
  del_ids.append(9107665.0)
  result_df = result_df[~result_df['comid'].isin(del_ids)]
  result_df.set_index('period', inplace=True)
  return result_df