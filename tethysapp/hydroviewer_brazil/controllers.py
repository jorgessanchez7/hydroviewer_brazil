from tethys_sdk.gizmos import *
from django.shortcuts import render
from tethys_sdk.gizmos import PlotlyView
from tethys_sdk.base import TethysAppBase
from tethys_sdk.workspaces import app_workspace
from tethys_sdk.permissions import has_permission
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required

import io
import os
import json
import pytz
import time
import requests
import geoglows
import xmltodict
import numpy as np
import pandas as pd
import urllib.error
import urllib.parse
import datetime as dt
import hydrostats.data
import scipy.stats as sp
import concurrent.futures
import plotly.graph_objs as go
from requests.auth import HTTPBasicAuth
from tethys_sdk.routing import controller

from .helpers import *
from .utils import warning_points
from .app import Hydroviewer as app
from dateutil.relativedelta import relativedelta

# Base
import io
import os
from dotenv import load_dotenv

#mongDB
from pymongo import MongoClient

####################################################################################################
##                                       STATUS VARIABLES                                         ##
####################################################################################################

base_name = __package__.split('.')[-1]
base_url = base_name.replace('_', '-')
cache_enabled = True

# Import enviromental variables 
load_dotenv()
MONGODB_URI = os.getenv('MONGODB_URI')

@controller(name='home', url=base_url)
def home(request):
	# Check if we have a default model. If we do, then redirect the user to the default model's page
	default_model = app.get_custom_setting('default_model_type')
	if default_model:
		model_func = switch_model(default_model)
		if model_func != 'invalid':
			return globals()[model_func](request)
		else:
			return home_standard(request)
	else:
		return home_standard(request)


def home_standard(request):
	model_input = SelectInput(display_text='',
							  name='model',
							  multiple=False,
							  options=[('Select Model', ''), ('ECMWF-RAPID', 'ecmwf')],
							  initial=['Select Model'],
							  original=True)

	zoom_info = TextInput(display_text='',
						  initial=json.dumps(app.get_custom_setting('zoom_info')),
						  name='zoom_info',
						  disabled=True)

	context = {
		"base_name": base_name,
		"model_input": model_input,
		"zoom_info": zoom_info
	}

	return render(request, '{0}/home.html'.format(base_name), context)

@controller(name='get-request-data', url='get-request-data')
def get_popup_response(request):
	"""
	get station attributes
	"""

	simulated_data_path_file = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
	f = open(simulated_data_path_file, 'w')
	f.close()

	stats_data_path_file = os.path.join(app.get_app_workspace().path, 'stats_data.json')
	f2 = open(stats_data_path_file, 'w')
	f2.close()

	ensemble_data_path_file = os.path.join(app.get_app_workspace().path, 'ensemble_data.json')
	f3 = open(ensemble_data_path_file, 'w')
	f3.close()

	# print("finished get_popup_response")

	return JsonResponse({})

@controller(name='ecmwf-rapid', url='ecmwf-rapid')
def ecmwf(request):
	# Can Set Default permissions : Only allowed for admin users
	can_update_default = has_permission(request, 'update_default')

	if (can_update_default):
		defaultUpdateButton = Button(
			display_text='Save',
			name='update_button',
			style='success',
			attributes={
				'data-toggle': 'tooltip',
				'data-placement': 'bottom',
				'title': 'Save as Default Options for WS'
			})
	else:
		defaultUpdateButton = False

	# Check if we need to hide the WS options dropdown.
	hiddenAttr = ""
	if app.get_custom_setting('show_dropdown') and app.get_custom_setting(
			'default_model_type') and app.get_custom_setting('default_watershed_name'):
		hiddenAttr = "hidden"

	init_model_val = request.GET.get('model', False) or app.get_custom_setting('default_model_type') or 'Select Model'
	init_ws_val = app.get_custom_setting('default_watershed_name') or 'Select Watershed'

	model_input = SelectInput(display_text='',
							  name='model',
							  multiple=False,
							  options=[('Select Model', ''), ('ECMWF-RAPID', 'ecmwf'),],
							  initial=[init_model_val],
							  classes=hiddenAttr,
							  original=True)

	# Retrieve a geoserver engine and geoserver credentials.
	geoserver_engine = app.get_spatial_dataset_service(
		name='main_geoserver', as_engine=True)

	geos_username = geoserver_engine.username
	geos_password = geoserver_engine.password
	my_geoserver = geoserver_engine.endpoint.replace('rest', '')

	watershed_list = [['Select Watershed', '']]  # + watershed_list

	res2 = requests.get(my_geoserver + '/rest/workspaces/' + app.get_custom_setting('workspace') +
						'/featuretypes.json', auth=HTTPBasicAuth(geos_username, geos_password), verify=False)
	for i in range(len(json.loads(res2.content)['featureTypes']['featureType'])):
		raw_feature = json.loads(res2.content)['featureTypes']['featureType'][i]['name']
		if 'drainage_line' in raw_feature and any(
				n in raw_feature for n in app.get_custom_setting('keywords').replace(' ', '').split(',')):
			feat_name = raw_feature.split('-')[0].replace('_', ' ').title() + ' (' + \
						raw_feature.split('-')[1].replace('_', ' ').title() + ')'
			if feat_name not in str(watershed_list):
				watershed_list.append([feat_name, feat_name])

	# Add the default WS if present and not already in the list
	if init_ws_val and init_ws_val not in str(watershed_list):
		watershed_list.append([init_ws_val, init_ws_val])

	watershed_select = SelectInput(display_text='',
								   name='watershed',
								   options=watershed_list,
								   initial=[init_ws_val],
								   original=True,
								   classes=hiddenAttr,
								   attributes={'onchange': "javascript:view_watershed();" + hiddenAttr}
								   )

	zoom_info = TextInput(display_text='',
						  initial=json.dumps(app.get_custom_setting('zoom_info')),
						  name='zoom_info',
						  disabled=True)

	# Retrieve a geoserver engine and geoserver credentials.
	geoserver_engine = app.get_spatial_dataset_service(
		name='main_geoserver', as_engine=True)

	my_geoserver = geoserver_engine.endpoint.replace('rest', '')

	geoserver_base_url = my_geoserver
	geoserver_workspace = app.get_custom_setting('workspace')
	region = app.get_custom_setting('region')
	geoserver_endpoint = TextInput(display_text='',
								   initial=json.dumps([geoserver_base_url, geoserver_workspace, region]),
								   name='geoserver_endpoint',
								   disabled=True)

	today = dt.datetime.now()
	year = str(today.year)
	month = str(today.strftime("%m"))
	day = str(today.strftime("%d"))
	date = day + '/' + month + '/' + year
	lastyear = int(year) - 1
	date2 = day + '/' + month + '/' + str(lastyear)

	startdateobs = DatePicker(name='startdateobs',
							  display_text='Start Date',
							  autoclose=True,
							  format='dd/mm/yyyy',
							  start_date='01/01/1950',
							  start_view='month',
							  today_button=True,
							  initial=date2,
							  classes='datepicker')

	enddateobs = DatePicker(name='enddateobs',
							display_text='End Date',
							autoclose=True,
							format='dd/mm/yyyy',
							start_date='01/01/1950',
							start_view='month',
							today_button=True,
							initial=date,
							classes='datepicker')

	res = requests.get('https://geoglows.ecmwf.int/api/AvailableDates/?region=central_america-geoglows', verify=False)
	data = res.json()
	dates_array = (data.get('available_dates'))

	dates = []

	for date in dates_array:
		if len(date) == 10:
			date_mod = date + '000'
			date_f = dt.datetime.strptime(date_mod, '%Y%m%d.%H%M').strftime('%Y-%m-%d %H:%M')
		else:
			date_f = dt.datetime.strptime(date, '%Y%m%d.%H%M').strftime('%Y-%m-%d')
			date = date[:-3]
		dates.append([date_f, date])
		dates = sorted(dates)

	dates.append(['Select Date', dates[-1][1]])
	# print(dates)
	dates.reverse()

	# Date Picker Options
	date_picker = DatePicker(name='datesSelect',
							 display_text='Date',
							 autoclose=True,
							 format='yyyy-mm-dd',
							 start_date=dates[-1][0],
							 end_date=dates[1][0],
							 start_view='month',
							 today_button=True,
							 initial='')

	region_index = json.load(open(os.path.join(os.path.dirname(__file__), 'public', 'geojson', 'index.json')))
	regions = SelectInput(
		display_text='Zoom to a Region:',
		name='regions',
		multiple=False,
		original=True,
		options=[(region_index[opt]['name'], opt) for opt in region_index]
	)

	# Select Basins
	basin_index = json.load(open(os.path.join(os.path.dirname(__file__), 'public', 'geojson2', 'index2.json')))
	basins = SelectInput(
		display_text='Zoom to a Basin:',
		name='basins',
		multiple=False,
		# original=True,
		options=[(basin_index[opt]['name'], opt) for opt in basin_index],
		initial='',
		select2_options={'placeholder': 'Select a Basin', 'allowClear': False}
	)

	# Select SubBasins
	subbasin_index = json.load(open(os.path.join(os.path.dirname(__file__), 'public', 'geojson3', 'index3.json')))
	subbasins = SelectInput(
		display_text='Zoom to a Subbasin:',
		name='subbasins',
		multiple=False,
		# original=True,
		options=[(subbasin_index[opt]['name'], opt) for opt in subbasin_index],
		initial='',
		select2_options={'placeholder': 'Select a Subbasin', 'allowClear': False}
	)

	context = {
		"base_name": base_name,
		"model_input": model_input,
		"watershed_select": watershed_select,
		"zoom_info": zoom_info,
		"geoserver_endpoint": geoserver_endpoint,
		"defaultUpdateButton": defaultUpdateButton,
		"startdateobs": startdateobs,
		"enddateobs": enddateobs,
		"date_picker": date_picker,
		"regions": regions,
		"basins": basins,
		"subbasins": subbasins,
	}

	return render(request, '{0}/ecmwf.html'.format(base_name), context)

@controller(name='get-warning-points', url='get-warning-points', app_workspace=True)
def get_warning_points(request, app_workspace):
	get_data = request.GET

	# print("REACH_PDS")
	# print(reach_ids_list)
	if get_data['model'] == 'ECMWF-RAPID':
		watershed = get_data['watershed']
		cache_path = os.path.join(app_workspace.path, f'warning_points_{ watershed }.csv')
		
		if os.path.exists(cache_path):
			df = pd.read_csv(cache_path)
			points = [c for c in zip(df['period'], df['comid'])]
			prob = probabilities(points, watershed, app_workspace.path)
			df = df.assign(probability=prob)

			return JsonResponse(df.values.tolist(), safe=False)

		try:
			result_df = warning_points.get_all_warning_points_data(app.get_custom_setting('api_source'), watershed, app_workspace.path)

			return JsonResponse(result_df.values.tolist(), safe=False)
		except:
			return JsonResponse({'error': 'No data found for the selected reach.'})
	else:
		pass

def create_rp(df_):
	war = {}

	list_coordinates = []
	for lat, lon, comid in zip(df_['lat'].tolist(), df_['lon'].tolist(), df_['comid'].tolist()):
		list_coordinates.append([lat, lon, comid])

	return list_coordinates

@controller(name='get-time-series', url='get-time-series', app_workspace=True)
def ecmwf_get_time_series(request, app_workspace):
	get_data = request.GET
	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		'''Getting Forecast Stats'''
		cache_stats_path = os.path.join(app_workspace.path, f'stats_{ watershed }.csv')
		stats_df = (pd.read_csv(cache_stats_path, index_col=0)
			if cache_enabled and os.path.exists(cache_stats_path)
			else pd.DataFrame())

		if not stats_df.empty:
			stats_df = stats_df[stats_df.comid == int(comid)]

		if stats_df.empty:
			'''Getting Forecast Stats'''
			if get_data['startdate'] != '':
				startdate = get_data['startdate']
			else:
				startdate = 'most_recent'

			'''Getting Forecast Stats'''
			if get_data['startdate'] != '':
				startdate = get_data['startdate']
				res = requests.get(app.get_custom_setting('api_source') + '/api/ForecastStats/?reach_id=' + comid + '&date=' + startdate + '&return_format=csv', verify=False).content
			else:
				res = requests.get(app.get_custom_setting('api_source') + '/api/ForecastStats/?reach_id=' + comid + '&return_format=csv', verify=False).content

			stats_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

		stats_df.index = pd.to_datetime(stats_df.index)
		stats_df[stats_df < 0] = 0
		stats_df.index = stats_df.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
		stats_df.index = pd.to_datetime(stats_df.index)

		stats_data_file_path = os.path.join(app.get_app_workspace().path, 'stats_data.json')
		stats_df.index.name = 'Datetime'
		stats_df.to_json(stats_data_file_path)

		hydroviewer_figure = geoglows.plots.forecast_stats(stats=stats_df, titles={'Reach ID': comid})

		x_vals = (stats_df.index[0], stats_df.index[len(stats_df.index) - 1], stats_df.index[len(stats_df.index) - 1],
				  stats_df.index[0])
		max_visible = max(stats_df.drop('comid', axis=1, errors='ignore').max())

		stats_df.drop('abc', axis=1, errors='ignore')

		'''Getting Forecast Records'''
		cache_records_path = os.path.join(app_workspace.path, f'records_{ watershed }.csv')
		records_df = (pd.read_csv(cache_records_path, index_col=0)
			if cache_enabled and os.path.exists(cache_records_path)
			else pd.DataFrame())

		if not records_df.empty:
			records_df = records_df[records_df.comid == int(comid)]

		if records_df.empty:
			res = requests.get(
				app.get_custom_setting('api_source') + '/api/ForecastRecords/?reach_id=' + comid + '&return_format=csv',
				verify=False).content
			records_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

		records_df.index = pd.to_datetime(records_df.index)
		records_df[records_df < 0] = 0
		records_df.index = records_df.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
		records_df.index = pd.to_datetime(records_df.index)

		records_df = records_df.loc[records_df.index >= pd.to_datetime(stats_df.index[0] - dt.timedelta(days=8))]
		records_df = records_df.loc[records_df.index <= pd.to_datetime(stats_df.index[0] + dt.timedelta(days=2))]

		if len(records_df.index) > 0:
			hydroviewer_figure.add_trace(go.Scatter(
				name='1st days forecasts',
				x=records_df.index,
				y=records_df.iloc[:, 0].values,
				line=dict(
					color='#FFA15A',
				)
			))

			x_vals = (
			records_df.index[0], stats_df.index[len(stats_df.index) - 1], stats_df.index[len(stats_df.index) - 1],
			records_df.index[0])
			max_visible = max(max(records_df.drop('comid', axis=1, errors='ignore').max()), max_visible)

		'''Getting Return Periods'''
		cache_periods_path = os.path.join(app_workspace.path, f'periods_{ watershed }.csv')
		rperiods_df = (pd.read_csv(cache_periods_path, index_col=0)
			if cache_enabled and os.path.exists(cache_periods_path)
			else pd.DataFrame())

		if not rperiods_df.empty:
			rperiods_df = rperiods_df[rperiods_df.index == int(comid)]

		if rperiods_df.empty:
			res = requests.get(
				app.get_custom_setting('api_source') + '/api/ReturnPeriods/?reach_id=' + comid + '&return_format=csv',
				verify=False).content

			rperiods_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

		r2 = int(rperiods_df.iloc[0]['return_period_2'])

		colors = {
			'2 Year': 'rgba(254, 240, 1, .4)',
			'5 Year': 'rgba(253, 154, 1, .4)',
			'10 Year': 'rgba(255, 56, 5, .4)',
			'20 Year': 'rgba(128, 0, 246, .4)',
			'25 Year': 'rgba(255, 0, 0, .4)',
			'50 Year': 'rgba(128, 0, 106, .4)',
			'100 Year': 'rgba(128, 0, 246, .4)',
		}

		if max_visible > r2:
			visible = True
			hydroviewer_figure.for_each_trace(
				lambda trace: trace.update(visible=True) if trace.name == "Maximum & Minimum Flow" else (), )
		else:
			visible = 'legendonly'
			hydroviewer_figure.for_each_trace(
				lambda trace: trace.update(visible=True) if trace.name == "Maximum & Minimum Flow" else (), )

		def template(name, y, color, fill='toself'):
			return go.Scatter(
				name=name,
				x=x_vals,
				y=y,
				legendgroup='returnperiods',
				fill=fill,
				visible=visible,
				line=dict(color=color, width=0))

		r5 = int(rperiods_df.iloc[0]['return_period_5'])
		r10 = int(rperiods_df.iloc[0]['return_period_10'])
		r25 = int(rperiods_df.iloc[0]['return_period_25'])
		r50 = int(rperiods_df.iloc[0]['return_period_50'])
		r100 = int(rperiods_df.iloc[0]['return_period_100'])

		hydroviewer_figure.add_trace(
			template('Return Periods', (r100 * 0.05, r100 * 0.05, r100 * 0.05, r100 * 0.05), 'rgba(0,0,0,0)',
					 fill='none'))
		hydroviewer_figure.add_trace(template(f'2 Year: {r2}', (r2, r2, r5, r5), colors['2 Year']))
		hydroviewer_figure.add_trace(template(f'5 Year: {r5}', (r5, r5, r10, r10), colors['5 Year']))
		hydroviewer_figure.add_trace(template(f'10 Year: {r10}', (r10, r10, r25, r25), colors['10 Year']))
		hydroviewer_figure.add_trace(template(f'25 Year: {r25}', (r25, r25, r50, r50), colors['25 Year']))
		hydroviewer_figure.add_trace(template(f'50 Year: {r50}', (r50, r50, r100, r100), colors['50 Year']))
		hydroviewer_figure.add_trace(template(f'100 Year: {r100}', (
		r100, r100, max(r100 + r100 * 0.05, max_visible), max(r100 + r100 * 0.05, max_visible)), colors['100 Year']))

		hydroviewer_figure['layout']['xaxis'].update(autorange=True)

		chart_obj = PlotlyView(hydroviewer_figure)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No data found for the selected reach.'})


def get_time_series(request):
	return ecmwf_get_time_series(request)

@controller(name='get-available-dates', url='get-available-dates', app_workspace=True)
def get_available_dates(request, app_workspace):
	get_data = request.GET

	watershed = get_data['watershed']
	subbasin = get_data['subbasin']
	comid = get_data['comid']

	cache_path = os.path.join(app_workspace.path, f'available_dates_{ watershed }-{ subbasin }.json')
	dates_array = []

	if cache_enabled and os.path.exists(cache_path):
		json_data = json.load(open(cache_path))
		dates_array = json_data.get('available_dates')
	else:
		res = requests.get(
			app.get_custom_setting('api_source') + '/api/AvailableDates/?region=' + watershed + '-' + subbasin,
			verify=False)

		data = res.json()

		dates_array = (data.get('available_dates'))

	dates = []

	for date in dates_array:
		if len(date) == 10:
			date_mod = date + '000'
			date_f = dt.datetime.strptime(date_mod, '%Y%m%d.%H%M').strftime('%Y-%m-%d %H:%M')
		else:
			date_f = dt.datetime.strptime(date, '%Y%m%d.%H%M').strftime('%Y-%m-%d')
			date = date[:-3]
		dates.append([date_f, date, watershed, subbasin, comid])

	dates.append(['Select Date', dates[-1][1]])
	# print(dates)
	dates.reverse()
	# print(dates)

	return JsonResponse({
		"success": "Data analysis complete!",
		"available_dates": json.dumps(dates)
	})

@controller(name='get-historic-data', url='get-historic-data', app_workspace=True)
def get_historic_data(request, app_workspace):
	"""""
	Returns ERA 5 hydrograph
	"""""

	get_data = request.GET
	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		cache_simulated_path = os.path.join(app_workspace.path, f'historic_simulation_{ watershed }.csv')
		simulated_df = (pd.read_csv(cache_simulated_path, index_col=0)
			if cache_enabled and os.path.exists(cache_simulated_path)
			else pd.DataFrame())

		if not simulated_df.empty:
			simulated_df = simulated_df[simulated_df.comid == int(comid)]

		if simulated_df.empty:
			era_res = requests.get(
				app.get_custom_setting('api_source') + '/api/HistoricSimulation/?reach_id=' + comid + '&return_format=csv',
				verify=False).content

			simulated_df = pd.read_csv(io.StringIO(era_res.decode('utf-8')), index_col=0)

		simulated_df[simulated_df < 0] = 0
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.index = simulated_df.index.to_series().dt.strftime("%Y-%m-%d")
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.drop('comid', inplace=True, axis=1, errors='ignore')

		simulated_data_file_path = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
		simulated_df.reset_index(level=0, inplace=True)
		simulated_df['datetime'] = simulated_df['datetime'].dt.strftime('%Y-%m-%d')
		simulated_df.set_index('datetime', inplace=True)
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.index.name = 'Datetime'
		simulated_df.to_json(simulated_data_file_path)

		'''Getting Return Periods'''
		cache_periods_path = os.path.join(app_workspace.path, f'periods_{ watershed }.csv')
		rperiods_df = (pd.read_csv(cache_periods_path, index_col=0)
			if cache_enabled and os.path.exists(cache_periods_path)
			else pd.DataFrame())

		if not rperiods_df.empty:
			rperiods_df = rperiods_df[rperiods_df.index == int(comid)]

		if rperiods_df.empty:
			res = requests.get(
				app.get_custom_setting('api_source') + '/api/ReturnPeriods/?reach_id=' + comid + '&return_format=csv',
				verify=False).content
			rperiods_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

		rperiods_df.drop('comid', inplace=True, axis=1, errors='ignore')
		hydroviewer_figure = geoglows.plots.historic_simulation(simulated_df, rperiods_df, titles={'Reach ID': comid})

		chart_obj = PlotlyView(hydroviewer_figure)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(e)
		print(str(e))
		return JsonResponse({'error': 'No historic data found for the selected reach.'})

@controller(name='get-flow-duration-curve', url='get-flow-duration-curve', app_workspace=True)
def get_flow_duration_curve(request, app_workspace):
	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		cache_path = os.path.join(app_workspace.path, f'historic_simulation_{ watershed }.csv')
		simulated_df = (pd.read_csv(cache_path, index_col=0)
			if cache_enabled and os.path.exists(cache_path)
			else pd.DataFrame())

		if not simulated_df.empty:
			simulated_df = simulated_df[simulated_df.comid == int(comid)]

		if simulated_df.empty:
			simulated_data_file_path = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
			simulated_df = pd.read_json(simulated_data_file_path, convert_dates=True)
			simulated_df.index = pd.to_datetime(simulated_df.index)
			simulated_df.sort_index(inplace=True, ascending=True)

		simulated_df[simulated_df < 0] = 0
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.index = simulated_df.index.to_series().dt.strftime("%Y-%m-%d")
		simulated_df.index = pd.to_datetime(simulated_df.index)

		hydroviewer_figure = geoglows.plots.flow_duration_curve(simulated_df, titles={'Reach ID': comid})

		chart_obj = PlotlyView(hydroviewer_figure)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No historic data found for calculating flow duration curve.'})

@controller(name='get-historic-data-csv', url='get-historic-data-csv')
def get_historic_data_csv(request):
	"""""
	Returns ERA 5 data as csv
	"""""

	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed_name']
		subbasin = get_data['subbasin_name']
		comid = get_data['reach_id']

		era_res = requests.get(
			app.get_custom_setting('api_source') + '/api/HistoricSimulation/?reach_id=' + comid + '&return_format=csv',
			verify=False).content

		simulated_data_file_path = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
		simulated_df = pd.read_json(simulated_data_file_path, convert_dates=True)
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.sort_index(inplace=True, ascending=True)

		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename=historic_streamflow_{0}_{1}_{2}.csv'.format(watershed,
																											subbasin,
																											comid)
		simulated_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

		return response

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No historic data found.'})


def get_forecast_data_csv(request):
	"""""
	Returns Forecast data as csv
	"""""

	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed_name']
		subbasin = get_data['subbasin_name']
		comid = get_data['reach_id']

		if get_data['startdate'] != '':
			startdate = get_data['startdate']
		else:
			startdate = 'most_recent'

		'''Getting Forecast Stats'''
		if get_data['startdate'] != '':
			startdate = get_data['startdate']
		else:
			startdate = 'most_recent'

		'''Getting Forecast Stats'''
		stats_data_file_path = os.path.join(app.get_app_workspace().path, 'stats_data.json')
		stats_df = pd.read_json(stats_data_file_path, convert_dates=True)
		stats_df.index = pd.to_datetime(stats_df.index)
		stats_df.sort_index(inplace=True, ascending=True)

		init_time = stats_df.index[0]
		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename=streamflow_forecast_{0}_{1}_{2}_{3}.csv'.format(
			watershed, subbasin, comid, init_time)

		stats_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

		return response

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No forecast data found.'})

@controller(name='get-forecast-ens-data-csv', url='get-forecast-ens-data-csv')
def get_forecast_ens_data_csv(request):
	"""""
	Returns Forecast data as csv
	"""""

	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed_name']
		subbasin = get_data['subbasin_name']
		comid = get_data['reach_id']

		if get_data['startdate'] != '':
			startdate = get_data['startdate']
		else:
			startdate = 'most_recent'

		'''Getting Forecast Stats'''
		if get_data['startdate'] != '':
			startdate = get_data['startdate']
		else:
			startdate = 'most_recent'

		'''Getting Forecast Stats'''
		ensemble_data_file_path = os.path.join(app.get_app_workspace().path, 'ensemble_data.json')
		ensemble_df = pd.read_json(ensemble_data_file_path, convert_dates=True)
		ensemble_df.index = pd.to_datetime(ensemble_df.index)
		ensemble_df.sort_index(inplace=True, ascending=True)

		init_time = ensemble_df.index[0]
		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename=streamflow_forecast_ens_{0}_{1}_{2}_{3}.csv'.format(watershed, subbasin, comid, init_time)

		ensemble_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

		return response

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No forecast data found.'})

@controller(name='get-daily-seasonal-streamflow', url='get-daily-seasonal-streamflow', app_workspace=True)
def get_daily_seasonal_streamflow(request, app_workspace):
	"""
	 Returns daily seasonal streamflow chart for unique river ID
	 """
	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		cache_path = os.path.join(app_workspace.path, f'historic_simulation_{ watershed }.csv')
		simulated_df = (pd.read_csv(cache_path, index_col=0)
			if cache_enabled and os.path.exists(cache_path)
			else pd.DataFrame())

		if not simulated_df.empty:
			simulated_df = simulated_df[simulated_df.comid == int(comid)]

		if simulated_df.empty:
			simulated_data_file_path = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
			simulated_df = pd.read_json(simulated_data_file_path, convert_dates=True)
			simulated_df.index = pd.to_datetime(simulated_df.index)
			simulated_df.sort_index(inplace=True, ascending=True)

		simulated_df[simulated_df < 0] = 0
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.index = simulated_df.index.to_series().dt.strftime("%Y-%m-%d")
		simulated_df.index = pd.to_datetime(simulated_df.index)

		dayavg_df = hydrostats.data.daily_average(simulated_df, rolling=True)

		hydroviewer_figure = geoglows.plots.daily_averages(dayavg_df, titles={'Reach ID': comid})

		chart_obj = PlotlyView(hydroviewer_figure)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No historic data found for calculating daily seasonality.'})

@controller(name='get-monthly-seasonal-streamflow', url='get-monthly-seasonal-streamflow', app_workspace=True)
def get_monthly_seasonal_streamflow(request, app_workspace):
	"""
	 Returns daily seasonal streamflow chart for unique river ID
	 """
	get_data = request.GET

	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		cache_path = os.path.join(app_workspace.path, f'historic_simulation_{ watershed }.csv')
		simulated_df = (pd.read_csv(cache_path, index_col=0)
			if cache_enabled and os.path.exists(cache_path)
			else pd.DataFrame())

		if not simulated_df.empty:
			simulated_df = simulated_df[simulated_df.comid == int(comid)]

		if simulated_df.empty:
			simulated_data_file_path = os.path.join(app.get_app_workspace().path, 'simulated_data.json')
			simulated_df = pd.read_json(simulated_data_file_path, convert_dates=True)
			simulated_df.index = pd.to_datetime(simulated_df.index)
			simulated_df.sort_index(inplace=True, ascending=True)

		simulated_df[simulated_df < 0] = 0
		simulated_df.index = pd.to_datetime(simulated_df.index)
		simulated_df.index = simulated_df.index.to_series().dt.strftime("%Y-%m-%d")
		simulated_df.index = pd.to_datetime(simulated_df.index)

		monavg_df = hydrostats.data.monthly_average(simulated_df)

		hydroviewer_figure = geoglows.plots.monthly_averages(monavg_df, titles={'Reach ID': comid})

		chart_obj = PlotlyView(hydroviewer_figure)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No historic data found for calculating monthly seasonality.'})

@controller(name='set_def_ws', url='admin/setdefault')
def setDefault(request):
	get_data = request.GET
	set_custom_setting(get_data.get('ws_name'), get_data.get('model_name'))
	return JsonResponse({'success': True})


def get_units_title(unit_type):
	"""
	Get the title for units
	"""
	units_title = "m"
	if unit_type == 'english':
		units_title = "ft"
	return units_title

@controller(name='forecastpercent', url='forecastpercent', app_workspace=True)
def forecastpercent(request, app_workspace):
	get_data = request.GET
	try:
		# model = get_data['model']
		watershed = get_data['watershed']
		subbasin = get_data['subbasin']
		comid = get_data['comid']
		units = 'metric'

		cache_stats_path = os.path.join(app_workspace.path, f'stats_{ watershed }.csv')
		stats_df = (pd.read_csv(cache_stats_path, index_col=0)
			if cache_enabled and os.path.exists(cache_stats_path)
			else pd.DataFrame())

		if not stats_df.empty:
			stats_df = stats_df[stats_df.comid == int(comid)]

		cache_ensemble_path = os.path.join(app_workspace.path, f'ensembles_{ watershed }.csv')
		ensemble_df = (pd.read_csv(cache_ensemble_path, index_col=0)
			if cache_enabled and os.path.exists(cache_ensemble_path)
			else pd.DataFrame())

		if not ensemble_df.empty:
			ensemble_df = ensemble_df[ensemble_df.comid == int(comid)]

		cache_periods_path = os.path.join(app_workspace.path, f'periods_{ watershed }.csv')
		rperiods_df = (pd.read_csv(cache_periods_path, index_col=0)
			if cache_enabled and os.path.exists(cache_periods_path)
			else pd.DataFrame())

		if not rperiods_df.empty:
			rperiods_df = rperiods_df[rperiods_df.index == int(comid)]

		'''Getting Forecast Stats'''
		if stats_df.empty:
			'''Forecast'''
			if get_data['startdate'] != '':
				startdate = get_data['startdate']
			else:
				startdate = 'most_recent'

			'''Getting Forecast Stats'''
			stats_data_file_path = os.path.join(app.get_app_workspace().path, 'stats_data.json')
			stats_df = pd.read_json(stats_data_file_path, convert_dates=True)
			stats_df.index = pd.to_datetime(stats_df.index)
			stats_df.sort_index(inplace=True, ascending=True)

		'''Getting Forecast Ensembles'''
		if ensemble_df.empty:
			if get_data['startdate'] != '':
				startdate = get_data['startdate']
			else:
				startdate = 'most_recent'

			if get_data['startdate'] != '':
				startdate = get_data['startdate']
				ens = requests.get(app.get_custom_setting('api_source') + '/api/ForecastEnsembles/?reach_id=' + comid + '&date=' + startdate + '&ensemble=all&return_format=csv', verify=False).content
			else:
				ens = requests.get(app.get_custom_setting('api_source') + '/api/ForecastEnsembles/?reach_id=' + comid + '&ensemble=all&return_format=csv', verify=False).content

			ensemble_df = pd.read_csv(io.StringIO(ens.decode('utf-8')), index_col=0)

		'''Getting Return Periods'''
		if rperiods_df.empty:
			res = requests.get(
				app.get_custom_setting('api_source') + '/api/ReturnPeriods/?reach_id=' + comid + '&return_format=csv',
				verify=False).content
			rperiods_df = pd.read_csv(io.StringIO(res.decode('utf-8')), index_col=0)

		stats_df.index = pd.to_datetime(stats_df.index)
		stats_df[stats_df < 0] = 0
		stats_df.index = stats_df.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
		stats_df.index = pd.to_datetime(stats_df.index)

		ensemble_df.index = pd.to_datetime(ensemble_df.index)
		ensemble_df[ensemble_df < 0] = 0
		ensemble_df.index = ensemble_df.index.to_series().dt.strftime("%Y-%m-%d %H:%M:%S")
		ensemble_df.index = pd.to_datetime(ensemble_df.index)

		ensemble_data_file_path = os.path.join(app.get_app_workspace().path, 'ensemble_data.json')
		ensemble_df.index.name = 'Datetime'
		ensemble_df.to_json(ensemble_data_file_path)

		ensemble_df.drop('comid', inplace=True, axis=1, errors='ignore')

		table = geoglows.plots.probabilities_table(stats_df, ensemble_df, rperiods_df)

		return HttpResponse(table)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No data found for the selected station.'})

@controller(name='get-discharge-data', url='get-discharge-data')
def get_discharge_data(request):
    
	get_data = request.GET

	try:
		stationCode = get_data['stationCode']
		# YYYY/MM/DD

		timezone = pytz.timezone('Brazil/East')
		currentDate = dt.datetime.now(timezone)
		startDate = currentDate - relativedelta(months=7)

		year = currentDate.year
		month = currentDate.month
		day = currentDate.day

		if day < 10:
			DD = '0' + str(day)
		else:
			DD = str(day)

		if month < 10:
			MM = '0' + str(month)
		else:
			MM = str(month)

		YYYY = str(year)

		startYear = startDate.year
		startMonth = startDate.month
		startDay = startDate.day

		if startDay < 10:
			ini_DD = '0' + str(startDay)
		else:
			ini_DD = str(startDay)

		if startMonth < 10:
			ini_MM = '0' + str(startMonth)
		else:
			ini_MM = str(startMonth)

		ini_YYYY = str(startYear)

		url = 'http://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao={0}&DataInicio={1}/{2}/{3}&DataFim={4}/{5}/{6}'.format(stationCode, ini_DD, ini_MM, ini_YYYY, DD, MM, YYYY)
		print(url)
		data = requests.get(url).content
		sites_dict = xmltodict.parse(data)
		sites_json_object = json.dumps(sites_dict)
		sites_json = json.loads(sites_json_object)

		hidro_data = sites_json["DataTable"]["diffgr:diffgram"]["DocumentElement"]["DadosHidrometereologicos"]

		discharge_values = []
		discharge_dates = []

		for dat in hidro_data:
			discharge_values.append(dat["Vazao"])
			discharge_dates.append(dat["DataHora"])

		pairs = [list(a) for a in zip(discharge_dates, discharge_values)]
		streamflow_df = pd.DataFrame(pairs, columns=['Datetime', 'Streamflow (m3/s)'])
		streamflow_df.set_index('Datetime', inplace=True)
		streamflow_df.index = pd.to_datetime(streamflow_df.index)
		streamflow_df.dropna(inplace=True)
		streamflow_df['Streamflow (m3/s)'] = streamflow_df['Streamflow (m3/s)'].astype(float)

		# print(streamflow_df)

		observed_Q = go.Scatter(
			x=streamflow_df.index,
			y=streamflow_df.iloc[:, 0].values,
			name='Observed')

		layout = go.Layout(title='Observed Discharge',
						   xaxis=dict(
							   title='Dates', ),
						   yaxis=dict(
							   title='Discharge (m<sup>3</sup>/s)',
							   nticks=10),
						   showlegend=True)
		
		chart_obj = PlotlyView(
			go.Figure(data=[observed_Q],
					  layout=layout)
		)

		context = {
			'gizmo_object': chart_obj,
		}

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No  data found for the station.'})

@controller(name='get-observed-discharge-csv', url='get-observed-discharge-csv')
def get_observed_discharge_csv(request):
	"""
	Get data from fews stations
	"""

	get_data = request.GET

	try:
		codEstacion = get_data['stationcode']
		nomEstacion = get_data['stationname']

		tz = pytz.timezone('Brazil/East')
		hoy = dt.datetime.now(tz)
		ini_date = hoy - relativedelta(months=7)

		anyo = hoy.year
		mes = hoy.month
		dia = hoy.day

		if dia < 10:
			DD = '0' + str(dia)
		else:
			DD = str(dia)

		if mes < 10:
			MM = '0' + str(mes)
		else:
			MM = str(mes)

		YYYY = str(anyo)

		ini_anyo = ini_date.year
		ini_mes = ini_date.month
		ini_dia = ini_date.day

		if ini_dia < 10:
			ini_DD = '0' + str(ini_dia)
		else:
			ini_DD = str(ini_dia)

		if ini_mes < 10:
			ini_MM = '0' + str(ini_mes)
		else:
			ini_MM = str(ini_mes)

		ini_YYYY = str(ini_anyo)

		url = 'http://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao={0}&DataInicio={1}/{2}/{3}&DataFim={4}/{5}/{6}'.format(
			codEstacion, ini_DD, ini_MM, ini_YYYY, DD, MM, YYYY)
		datos = requests.get(url).content
		sites_dict = xmltodict.parse(datos)
		sites_json_object = json.dumps(sites_dict)
		sites_json = json.loads(sites_json_object)

		datos_c = sites_json["DataTable"]["diffgr:diffgram"]["DocumentElement"]["DadosHidrometereologicos"]

		list_val_vazao = []
		list_date_vazao = []

		for dat in datos_c:
			list_val_vazao.append(dat["Vazao"])
			list_date_vazao.append(dat["DataHora"])

		pairs = [list(a) for a in zip(list_date_vazao, list_val_vazao)]
		streamflow_df = pd.DataFrame(pairs, columns=['Datetime', 'Streamflow (m3/s)'])
		streamflow_df.set_index('Datetime', inplace=True)
		streamflow_df.index = pd.to_datetime(streamflow_df.index)
		streamflow_df.dropna(inplace=True)

		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename=observed_streamflow_{0}_{1}.csv'.format(codEstacion, nomEstacion)

		streamflow_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

		return response

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'An unknown error occurred while retrieving the Discharge Data.'})

@controller(name='get-historical-observed-discharge-csv', url='get-historical-observed-discharge-csv')
def get_historical_observed_discharge_csv(request):
	get_data = request.GET

	try:
		stationCode = get_data['stationcode']
		stationName = get_data['stationname']
		
		client = MongoClient(MONGODB_URI)
        
		database = client["hydroviewer"]

		collection = database["stations"]

		get_data = request.GET
        
		cursor = list(collection.find({"_id": stationCode}))
        
		if stationCode:
			record = collection.find_one({"_id": stationCode})
            
			if record and len(cursor) > 0:
				discharge_values = record["Qobs"]
				discharge_dates = record["Date"]

				pairs = [list(a) for a in zip(discharge_dates, discharge_values)]
				streamflow_df = pd.DataFrame(pairs, columns=['Datetime', 'Streamflow (m3/s)'])
				streamflow_df.set_index('Datetime', inplace=True)
				streamflow_df.index = pd.to_datetime(streamflow_df.index)
				streamflow_df.dropna(inplace=True)

				response = HttpResponse(content_type='text/csv')
				response['Content-Disposition'] = 'attachment; filename=observed_streamflow_{0}_{1}.csv'.format(stationCode, stationName)

				streamflow_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

				return response

			else:
				return HttpResponse("No data found for the provided station code.")
		else:
			return HttpResponse("Please provide a valid station code.")

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'An unknown error occurred while retrieving the Discharge Data.'})

	except pymongo.errors.PyMongoError as e:
        # Tratar exceção do MongoDB, se necessário
		return HttpResponse(f"An error occurred: {e}")
    
	finally:
        # Fechar a conexão com o MongoDB
		client.close()

@controller(name='get-waterlevel-data', url='get-waterlevel-data')
def get_waterlevel_data(request):

	get_data = request.GET
	
	try:
		stationCode = get_data['stationCode']
		# YYYY/MM/DD

		timezone = pytz.timezone('Brazil/East')
		currentDate = dt.datetime.now(timezone)
		startDate = currentDate - relativedelta(months=7)

		year = currentDate.year
		month = currentDate.month
		day = currentDate.day

		if day < 10:
			DD = '0' + str(day)
		else:
			DD = str(day)

		if month < 10:
			MM = '0' + str(month)
		else:
			MM = str(month)

		YYYY = str(year)

		startYear = startDate.year
		startMonth = startDate.month
		startDay = startDate.day

		if startDay < 10:
			ini_DD = '0' + str(startDay)
		else:
			ini_DD = str(startDay)

		if startMonth < 10:
			ini_MM = '0' + str(startMonth)
		else:
			ini_MM = str(startMonth)

		ini_YYYY = str(startYear)

		url = 'http://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao={0}&DataInicio={1}/{2}/{3}&DataFim={4}/{5}/{6}'.format(
			stationCode, ini_DD, ini_MM, ini_YYYY, DD, MM, YYYY)
		data = requests.get(url).content
		sites_dict = xmltodict.parse(data)
		sites_json_object = json.dumps(sites_dict)
		sites_json = json.loads(sites_json_object)

		water_level_values = []
		water_level_dates = []

		hidro_data = sites_json["DataTable"]["diffgr:diffgram"]["DocumentElement"]["DadosHidrometereologicos"]

		for dat in hidro_data:
			water_level_values.append(dat["Nivel"])
			water_level_dates.append(dat["DataHora"])

		pairs = [list(a) for a in zip(water_level_dates, water_level_values)]
		waterLevel_df = pd.DataFrame(pairs, columns=['Datetime', 'Water Level (m)'])
		waterLevel_df.set_index('Datetime', inplace=True)
		waterLevel_df.index = pd.to_datetime(waterLevel_df.index)
		waterLevel_df.dropna(inplace=True)
		waterLevel_df['Water Level (m)'] = waterLevel_df['Water Level (m)'].astype(float)


		observed_WL = go.Scatter(
			x=waterLevel_df.index,
			y=waterLevel_df.iloc[:, 0].values,
			name='Observed'
		)

		layout = go.Layout(title='Observed Water Level',
						   xaxis=dict(
							   title='Dates', ),
						   yaxis=dict(
							   title='Water Level (m)',
							   nticks=10),
						   showlegend=True)

		chart_obj = PlotlyView(
			go.Figure(data=[observed_WL],
					  layout=layout)
		)

		context = {
			'gizmo_object': chart_obj,
		}
		# print(context)

		return render(request, '{0}/gizmo_ajax.html'.format(base_name), context)

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'No  data found for the station.'})

@controller(name='get-observed-waterlevel-csv', url='get-observed-waterlevel-csv')
def get_observed_waterlevel_csv(request):
	"""
	Get data from fews stations
	"""

	get_data = request.GET

	try:
		codEstacion = get_data['stationcode']
		nomEstacion = get_data['stationname']

		tz = pytz.timezone('Brazil/East')
		hoy = dt.datetime.now(tz)
		ini_date = hoy - relativedelta(months=7)

		anyo = hoy.year
		mes = hoy.month
		dia = hoy.day

		if dia < 10:
			DD = '0' + str(dia)
		else:
			DD = str(dia)

		if mes < 10:
			MM = '0' + str(mes)
		else:
			MM = str(mes)

		YYYY = str(anyo)

		ini_anyo = ini_date.year
		ini_mes = ini_date.month
		ini_dia = ini_date.day

		if ini_dia < 10:
			ini_DD = '0' + str(ini_dia)
		else:
			ini_DD = str(ini_dia)

		if ini_mes < 10:
			ini_MM = '0' + str(ini_mes)
		else:
			ini_MM = str(ini_mes)

		ini_YYYY = str(ini_anyo)

		url = 'http://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao={0}&DataInicio={1}/{2}/{3}&DataFim={4}/{5}/{6}'.format(
			codEstacion, ini_DD, ini_MM, ini_YYYY, DD, MM, YYYY)
		datos = requests.get(url).content
		sites_dict = xmltodict.parse(datos)
		sites_json_object = json.dumps(sites_dict)
		sites_json = json.loads(sites_json_object)

		list_val_nivel = []
		list_date_nivel = []

		datos_c = sites_json["DataTable"]["diffgr:diffgram"]["DocumentElement"]["DadosHidrometereologicos"]

		for dat in datos_c:
			list_val_nivel.append(dat["Nivel"])
			list_date_nivel.append(dat["DataHora"])

		pairs = [list(a) for a in zip(list_date_nivel, list_val_nivel)]
		waterLevel_df = pd.DataFrame(pairs, columns=['Datetime', 'Water Level (m)'])
		waterLevel_df.set_index('Datetime', inplace=True)
		waterLevel_df.index = pd.to_datetime(waterLevel_df.index)
		waterLevel_df.dropna(inplace=True)

		response = HttpResponse(content_type='text/csv')
		response['Content-Disposition'] = 'attachment; filename=observed_water_level_{0}_{1}.csv'.format(codEstacion, nomEstacion)

		waterLevel_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

		return response

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'An unknown error occurred while retrieving the Water Level Data.'})

@controller(name='get-historical-observed-waterlevel-csv', url='get-historical-observed-waterlevel-csv')
def get_historical_observed_waterlevel_csv(request):
	get_data = request.GET

	try:
		stationCode = get_data['stationcode']
		stationName = get_data['stationname']
		
		client = MongoClient(MONGODB_URI)
        
		database = client["hydroviewer"]

		collection = database["stations"]

		get_data = request.GET
        
		cursor = list(collection.find({"_id": stationCode}))
        
		if stationCode:
			record = collection.find_one({"_id": stationCode})
            
			if record and len(cursor) > 0:
				water_level_values = record["QGlofas"]
				water_level_dates = record["Date"]

				pairs = [list(a) for a in zip(water_level_dates, water_level_values)]
				waterLevel_df = pd.DataFrame(pairs, columns=['Datetime', 'Water Level (m)'])
				waterLevel_df.set_index('Datetime', inplace=True)
				waterLevel_df.index = pd.to_datetime(waterLevel_df.index)
				waterLevel_df.dropna(inplace=True)

				response = HttpResponse(content_type='text/csv')
				response['Content-Disposition'] = 'attachment; filename=observed_water_level_{0}_{1}.csv'.format(stationCode, stationName)

				waterLevel_df.to_csv(encoding='utf-8', header=True, path_or_buf=response)

				return response

			else:
				return HttpResponse("No data found for the provided station code.")
		else:
			return HttpResponse("Please provide a valid station code.")

	except Exception as e:
		print(str(e))
		return JsonResponse({'error': 'An unknown error occurred while retrieving the Discharge Data.'})

	except pymongo.errors.PyMongoError as e:
        # Tratar exceção do MongoDB, se necessário
		return HttpResponse(f"An error occurred: {e}")
    
	finally:
        # Fechar a conexão com o MongoDB
		client.close()

def probabilities(points, watershed, workspace_path):
	if not cache_enabled:
		return []

	path = os.path.join(workspace_path, f'ensembles_{ watershed }.csv')
	ensembles_df = (pd.read_csv(path, index_col=0)
		if os.path.exists(path)
		else pd.DataFrame())
	
	path = os.path.join(workspace_path, f'periods_{ watershed }.csv')
	rperiods_df = (pd.read_csv(path, index_col=0)
		if os.path.exists(path)
		else pd.DataFrame())
	
	if ensembles_df.empty or rperiods_df.empty:
		return []

	startdate = dt.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=4)
	enddate = startdate + dt.timedelta(days=1)

	def handle(point):
		[ period, comid ] = point
		ensembles = ensembles_df[ensembles_df.comid == int(comid)]
		ensembles.index = pd.to_datetime(ensembles.index).tz_localize(None)
		rperiods = rperiods_df[rperiods_df.index == int(comid)]
		uniqueday = [ startdate, enddate ]

		# get the return periods for the stream reach
		rp2 = rperiods['return_period_2'].values
		rp5 = rperiods['return_period_5'].values
		rp10 = rperiods['return_period_10'].values
		rp25 = rperiods['return_period_25'].values
		rp50 = rperiods['return_period_50'].values
		rp100 = rperiods['return_period_100'].values
		# fill the lists of things used as context in rendering the template
		tmp = ensembles.loc[uniqueday[0]:uniqueday[1]]
		
		result = 0

		for column in tmp:
			if column == 'comid':
				continue

			try:
				column_max = tmp[column].to_numpy().max()

				if period == 100 and column_max > rp100:
						result += 1
				if period == 50 and column_max > rp50:
						result += 1
				if period == 25 and column_max > rp25:
						result += 1
				if period == 10 and column_max > rp10:
						result += 1
				if period == 5 and column_max > rp5:
						result += 1
				if period == 2 and column_max > rp2:
						result += 1
			except:
				pass

		return round(result * 100 / 52)

	results = []

	with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
		results = executor.map(handle, points)

	return list(results)

####################################################################################################
##                                           mongoDB                                              ##
####################################################################################################

# Return station in geojson format 
@controller(name='get_station', url='get-station')
def get_station(request):
    try:
        client = MongoClient(MONGODB_URI)
        
        database = client["hydroviewer"]

        collection = database["stations"]

        get_data = request.GET
        
        stationCode = get_data.get('stationCode')
        
        cursor = list(collection.find({"_id": stationCode}))
        
        if stationCode:
            record = collection.find_one({"_id": stationCode})
            
            if record and len(cursor) > 0:
                return JsonResponse({"station": record})
            else:
                return HttpResponse("No data found for the provided station code.")
        else:
            return HttpResponse("Please provide a valid station code.")

    except pymongo.errors.PyMongoError as e:
        return HttpResponse(f"An error occurred: {e}")
    
    finally:
        client.close()
        
# Return all stations in geojson format 
@controller(name='get_all_stations', url='get-all-stations')
def get_all_stations(_):
    try:
        # Conectar ao servidor MongoDB (pode ser necessário ajustar a URL e a porta)
        client = MongoClient(MONGODB_URI)
        # Selecionar a base de dados
        database = client["hydroviewer"]

        # Selecionar a coleção
        collection = database["stations"]

        items = list(collection.find())
        
        def mapItem(item):
            return {
                "id": item["_id"],
                "name": item["Name"],
                "lat": item["Lat"],
                "lon": item["Lon"]
            }
            
        parsedItems = list(map(mapItem, items))
        
        return JsonResponse({"stations": parsedItems})
    
    except pymongo.errors.PyMongoError as e:
        return HttpResponse(f"An error occurred: {e}")
    
    finally:
        client.close()
        
# Return all streams in geojson format 
@controller(name='get_all_streams', url='get-all-streams')
def get_all_streams(_):
    try:
        client = MongoClient(MONGODB_URI)
        
        database = client["hydroviewer"]

        collection = database["streams"]
        
        items = list(collection.find())
        
        def mapItem(item):
            return {
                "type": "Feature",
                "geometry": item["geometry"],
                "properties": {}
            }
            
        parsedItems = list(map(mapItem, items))
        
        # print(parsedItems[0])
        
        return JsonResponse({
            "streams": {
				"type": "FeatureCollection",
  				"features": parsedItems
			}
        })
    
    except pymongo.errors.PyMongoError as e:
        return HttpResponse(f"An error occurred: {e}")
    
    finally:
        client.close()
