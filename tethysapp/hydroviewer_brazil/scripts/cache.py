import os
import requests
import time
import datetime as dt
import pandas as pd
from tethysapp.hydroviewer_brazil.utils import warning_points
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from tethysapp.hydroviewer_brazil.utils import cache

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

API_SOURCE = 'https://geoglows.ecmwf.int'
WATERSHED = 'south_america'
SUBBASIN = 'geoglows'
WORKSPACE_DIR = '../workspaces/app_workspace'

def get_request(url):
  res = requests.get(url, verify=False)
  return (res.ok, res.content)

def cache_stats(warning_points):
  print('Preparing stats cache')

  start = time.time()

  def on_result(result, comid):
    return result.assign(comid=comid)

  result = cache.cache_results(warning_points, '/api/ForecastStats/?reach_id=\%COMID\%&return_format=csv', on_result)
  result.to_csv(os.path.join(WORKSPACE_DIR, f'stats_{ WATERSHED }.csv'), index=False)

  print('Finished stats cache in:', time.time() - start, 's\n')

  return result

def cache_ensembles(warning_points):
  print('Preparing ensembles cache')
  start = time.time()

  def on_result(result, comid):
    return result.assign(comid=comid)

  result = cache.cache_results(warning_points, '/api/ForecastEnsembles/?reach_id=\%COMID\%&return_format=csv', on_result)
  result.to_csv(os.path.join(WORKSPACE_DIR, f'ensembles_{ WATERSHED }.csv'), index=False)

  print('Finished ensembles cache in:', time.time() - start, 's\n')

  return result

def cache_return_periods(warning_points, new_warnings):
  print('Preparing return periods cache')
  start = time.time()

  def on_result(result, comid):
    return result.assign(comid=comid)

  result = cache.cache_results(warning_points, '/api/ReturnPeriods/?reach_id=\%COMID\%&return_format=csv', on_result)
  result = pd.concat([result, new_warnings])
  result.to_csv(os.path.join(WORKSPACE_DIR, f'periods_{ WATERSHED }.csv'), index=False)

  print('Finished return periods cache in:', time.time() - start, 's\n')
  return result

def cache_historic_simulation(warning_points):
  print('Preparing historic simulation cache')
  start = time.time()

  def on_result(result, comid):
    return result.assign(comid=comid)

  result = cache.cache_results(warning_points, '/api/HistoricSimulation/?reach_id=\%COMID\%&return_format=csv', on_result)
  result.to_csv(os.path.join(WORKSPACE_DIR, f'historic_simulation_{ WATERSHED }.csv'), index=False)

  print('Finished historic simulation cache in:', time.time() - start, 's\n')

  return result

def cache_available_dates():
  print('Preparing available dates cache')
  start = time.time()

  res = requests.get(f'{ API_SOURCE }/api/AvailableDates/?region={ WATERSHED }', verify=False)

  if res.ok != True:
    res = requests.get(f'{ API_SOURCE }/api/AvailableDates/?region={ WATERSHED }-{ SUBBASIN }', verify=False)
  
  with open(os.path.join(WORKSPACE_DIR, f'available_dates_{ WATERSHED }-{ SUBBASIN }.json'), 'w') as outfile:
    outfile.write(res.text)

  print('Finished available dates cache in:', time.time() - start, 's\n')

def cache_records(warning_points, dt_start):
  print('Preparing records cache')
  start = time.time()

  def on_result(result, comid):
    result = result.set_index('datetime')
    result.index = pd.to_datetime(result.index)
    result[result < 0] = 0
    result.index = result.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
    result.index = pd.to_datetime(result.index)

    result = result.loc[result.index >= pd.to_datetime(dt_start) - dt.timedelta(days=8)]
    result = result.loc[result.index <= pd.to_datetime(dt_start) + dt.timedelta(days=2)]
    result = result.assign(comid=comid)

    return result.reset_index()

  result = cache.cache_results(warning_points, '/api/ForecastRecords/?reach_id=\%COMID\%&return_format=csv', on_result)
  result.to_csv(os.path.join(WORKSPACE_DIR, f'records_{ WATERSHED }.csv'), index=False)

  print('Finished records cache in:', time.time() - start, 's\n')

def catch_warning_points(wps):
  result_df = warning_points.get_all_warning_points_data(API_SOURCE, WATERSHED, warning_points=wps)
  result_df.to_csv(os.path.join(WORKSPACE_DIR, f'warning_points_{ WATERSHED }.csv'))
  return result_df

def create_cache():
  script_start = time.time()

  wps = warning_points.get_warning_points(API_SOURCE, WATERSHED, WORKSPACE_DIR)
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

  ecmwf_wps = pd.concat(dataframes)
  new_wp, new_wp_periods = warning_points.get_new_warnings()  
  wps_df = pd.concat([ecmwf_wps,new_wp])


  '''First cache stats, as it's used on other caches'''
  stats = cache_stats(wps_df)
  start = pd.to_datetime(stats.datetime[0]).iloc[0].strftime("%Y-%m-%d %H:%M:%S")

  cache_return_periods(ecmwf_wps, new_wp_periods)
  wp = catch_warning_points(wps_df)
  cache_ensembles(wp)
  cache_records(wp, start)
  cache_available_dates()
  cache_historic_simulation(wp)

  print('Caches finished in:', time.time() - script_start, 's')

create_cache()