import io
import requests
import concurrent.futures
import pandas as pd
from tqdm import tqdm
from requests.packages.urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

API_SOURCE = 'https://geoglows.ecmwf.int'
WATERSHED = 'south_america'
WORKSPACE_DIR = '../workspaces/app_workspace'

def get_request(url):
  res = requests.get(url, verify=False)
  return (res.ok, res.content)

def handle_comid(comid, url, on_result = None):
  result_ok, result = get_request(API_SOURCE + url.replace('\%COMID\%', str(comid)))

  if result_ok == False:
    return (comid, pd.DataFrame())

  results_df = pd.read_csv(io.StringIO(result.decode('utf-8')))

  return (comid, on_result(results_df, comid) if on_result != None else results_df)

def handle_comids(comids, url, on_result):
  results = []

  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    results = list(tqdm(executor.map(lambda c: handle_comid(c, url, on_result), comids), total=len(comids)))

  all = []
  retry = []

  def handle_results(results):
    for comid, result in results:
      if result.empty:
        retry.append(comid)
        continue

      all.append(result)

  handle_results(results)

  print(len(all), 'results succeeded')

  if len(retry) > 0:
    print('and', len(retry), 'comid(s) failed. Retrying one more time')

    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
      results = executor.map(lambda c: handle_comid(c, url, on_result), retry)

    retry = []
    handle_results(results)

  if len(retry) > 0:
    print(len(retry), 'comid(s) failed a second time. Not retrying')

  return pd.concat(all)

def cache_results(warning_points, url, on_result):
  comids = list(warning_points.comid.unique())
  return handle_comids(comids, url, on_result)
