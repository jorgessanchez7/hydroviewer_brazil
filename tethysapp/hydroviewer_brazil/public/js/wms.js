/* Global Variables */
var default_extent,
    current_layer,
    current_feature,
    feature_layer,
    stream_geom,
    layers,
    wmsLayer,
    wmsLayer2,
    vectorLayer,
    feature,
    featureOverlay,
    forecastFolder,
    select_interaction,
    two_year_warning,
    five_year_warning,
    ten_year_warning,
    twenty_five_year_warning,
    fifty_year_warning,
    hundred_year_warning,
    map,
    wms_layers,
    allWarningActive;

var $loading = $('#view-file-loading');
var m_downloaded_historical_streamflow = false;
var m_downloaded_flow_duration = false;

const wmsWorkspace = 'HS-11765271903a45d483416ce57bf8c710';
const glofasURL = `http://globalfloods-ows.ecmwf.int/glofas-ows/ows.py`
const observedLayers = [];

const DEFAULT_COLOR = [106, 102, 110];
const HUNDRED_YEAR_WARNING_COLOR = [128,0,246];
const FIFTY_YEAR_WARNING_COLOR = [128,0,106];
const TWENTY_FIVE_YEAR_WARNING_COLOR = [255,0,0];
const TEN_YEAR_WARNING_COLOR = [255,56,5];
const FIVE_YEAR_WARNING_COLOR = [253,154,1];
const TWO_YEAR_WARNING_COLOR = [254,240,1];
const REGION_COLOR = [0,100,0];
const NEUTRO_COLOR = [46,139,87]


function warning_point_style(feature, color) {
    const layerIndex = observedLayers.length - (observedLayers.findIndex(({ layer }) => layer === feature) ?? observedLayers.length);
    const flow = feature.get('flow');
    const exceed = String(feature.get('exceed'));
    const peaks = feature.get('peaks');
    const alpha = peaks === 0 ? 1 : (peaks === 1 ? 0.5 : 0.1);
    const strokes = peaks === 0 ? 1 : (peaks === 2 ? 0.5 : 0.1);
    
    const style = {
        text: new ol.style.Text({
            font: '14px Calibri,sans-serif',
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({
                color: '#fff', width: 3,
            }),
            text: exceed === '0' ? '' : exceed,
            offsetX: 10,
            offsetY: -10,
            zIndex: layerIndex,
        }),
    };

    if (flow === 'same') {
        style.image = new ol.style.Circle({
            fill: new ol.style.Fill({ color: Array.isArray(color) ? [ ...color, alpha] : color }),
            stroke: new ol.style.Stroke({ color: 'black', width: strokes }),
            radius: 10,
            zIndex: layerIndex,
        });
    } else if (flow === 'up' || flow === 'down'){
        style.image = new ol.style.RegularShape({
            fill: new ol.style.Fill({ color: Array.isArray(color) ? [ ...color, alpha] : color }),
            stroke: new ol.style.Stroke({ color: 'black', width: strokes }),
            points: 3,
            radius: 10,
            angle: flow === 'up' ? 0 : Math.PI,
            zIndex: layerIndex,
        });
    }

    return new ol.style.Style(style);
}

function get_requestData (model, watershed, subbasin, comid, startdate){
  getdata = {
      'model': model,
      'watershed': watershed,
      'subbasin': subbasin,
      'comid': comid,
      'startdate': startdate
  };
  $.ajax({
      url: 'get-request-data',
      type: 'GET',
      data: getdata,
      error: function() {
          $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the data</strong></p>');
          $('#info').removeClass('hidden');
          console.log(e);
          $('#historical-chart').addClass('hidden');
          $('#fdc-chart').addClass('hidden');
          $('#seasonal_d-chart').addClass('hidden');
          $('#seasonal_m-chart').addClass('hidden');
          setTimeout(function () {
              $('#info').addClass('hidden')
          }, 5000);
      },
      success: function (data) {
        get_time_series(model, watershed, subbasin, comid, startdate);
        get_historic_data(model, watershed, subbasin, comid, startdate);
        get_flow_duration_curve(model, watershed, subbasin, comid, startdate);
        get_daily_seasonal_streamflow(model, watershed, subbasin, comid, startdate);
        get_monthly_seasonal_streamflow(model, watershed, subbasin, comid, startdate);
      }
  })

}

function init_map() {
    var base_layer = new ol.layer.Tile({
        source: new ol.source.OSM({
        })
    });


    wms_layers = [
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: glofasURL,
                params: { LAYERS: 'AccRainEGE', TILED: true },
                serverType: 'mapserver'
                // crossOrigin: 'Anonymous'
            }),
            visible: false
        }),
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: glofasURL,
                params: { LAYERS: 'EGE_probRgt50', TILED: true },
                serverType: 'mapserver'
                // crossOrigin: 'Anonymous'
            }),
            visible: false
        }),
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: glofasURL,
                params: { LAYERS: 'EGE_probRgt150', TILED: true },
                serverType: 'mapserver'
                // crossOrigin: 'Anonymous'
            }),
            visible: false
        }),
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: glofasURL,
                params: { LAYERS: 'EGE_probRgt300', TILED: true },
                serverType: 'mapserver'
                // crossOrigin: 'Anonymous'
            }),
            visible: false
        })
    ];


    featureOverlay = new ol.layer.Vector({
        source: new ol.source.Vector()
    });

    two_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, TWO_YEAR_WARNING_COLOR),
    });

    five_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, FIVE_YEAR_WARNING_COLOR),
    });

    ten_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, TEN_YEAR_WARNING_COLOR),
    });

    twenty_five_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, TWENTY_FIVE_YEAR_WARNING_COLOR),
    });

    fifty_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, FIFTY_YEAR_WARNING_COLOR),
    });

    hundred_year_warning = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: (feature) => warning_point_style(feature, HUNDRED_YEAR_WARNING_COLOR),
    });

    if ($('#model option:selected').text() === 'ECMWF-RAPID') {
        var wmsLayer = new ol.layer.Image({
            source: new ol.source.ImageWMS({
                url: JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + '/wms',
                params: { 'LAYERS': 'province_boundaries' },
                serverType: 'geoserver',
                crossOrigin: 'Anonymous'
            })
        });

        layers = [base_layer, two_year_warning, five_year_warning, ten_year_warning, twenty_five_year_warning, fifty_year_warning, hundred_year_warning].concat(wms_layers).concat([wmsLayer, featureOverlay])
        // layers = [base_layer, two_year_warning, five_year_warning, ten_year_warning, twenty_five_year_warning, fifty_year_warning, hundred_year_warning].concat(wms_layers)
    } else {
        layers = [base_layer, two_year_warning, five_year_warning, ten_year_warning, twenty_five_year_warning, fifty_year_warning, hundred_year_warning].concat(wms_layers).concat([featureOverlay])
    }

    var lon = Number(JSON.parse($('#zoom_info').val()).split(',')[0]);
    var lat = Number(JSON.parse($('#zoom_info').val()).split(',')[1]);
    var zoomLevel = Number(JSON.parse($('#zoom_info').val()).split(',')[2]);
    map = new ol.Map({
        target: 'map',
        view: new ol.View({
            center: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
            zoom: zoomLevel,
            minZoom: 2,
            maxZoom: 18,
        }),
        layers: layers
    });

    default_extent = map.getView().calculateExtent(map.getSize());

}

function watershed_layer_name() {
    var workspace = JSON.parse($('#geoserver_endpoint').val())[1];
    var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
    var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();

    return workspace + ':' + watershed + '-' + subbasin + '-geoglows-drainage_line';
}

function view_watershed() {
    map.removeInteraction(select_interaction);
    map.removeLayer(wmsLayer);
    $("#get-started").modal('hide');
    if ($('#model option:selected').text() === 'ECMWF-RAPID' && $('#watershedSelect option:selected').val() !== "") {

        $("#watershed-info").empty();

        $('#dates').addClass('hidden');

        //var workspace = JSON.parse($('#geoserver_endpoint').val())[1];
        var model = $('#model option:selected').text();
        var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
        var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();
        var watershed_display_name = $('#watershedSelect option:selected').text().split(' (')[0];
        var subbasin_display_name = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '');
        $("#watershed-info").append('<h3>Current Watershed: ' + watershed_display_name + '</h3><h5>Subbasin Name: ' + subbasin_display_name);

        // var layerName = watershed_layer_name();

        const style = `
        <?xml version="1.0" encoding="ISO-8859-1"?>
        <StyledLayerDescriptor version="1.0.0"
            xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
            xmlns="http://www.opengis.net/sld"
            xmlns:ogc="http://www.opengis.net/ogc"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <NamedLayer>
                <Name>${ wmsWorkspace }:Brazil_Stations_RT</Name>
                <UserStyle>
                    <FeatureTypeStyle>
                        <Rule>
                            <PointSymbolizer>
                                <Graphic>
                                    <Mark>
                                        <WellKnownName>square</WellKnownName>
                                        <Fill>
                                            <CssParameter name="fill">#000000</CssParameter>
                                        </Fill>
                                    </Mark>
                                    <Size>6</Size>
                                </Graphic>
                           </PointSymbolizer>
                         </Rule>
                    </FeatureTypeStyle>
                </UserStyle>
            </NamedLayer>
        </StyledLayerDescriptor>
        `;

        wmsLayer = new ol.layer.Image({
            source: new ol.source.ImageWMS({
                //url: JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + '/wms',
                url: `https://geoserver.hydroshare.org/geoserver/${ wmsWorkspace }/wms`,
                //params: { 'LAYERS': layerName },
                params: {'LAYERS': 'south_america-brazil-geoglows-drainage_line' },
                serverType: 'geoserver',
                crossOrigin: 'Anonymous'
            }),
            opacity: 0.4
        });
        feature_layer = wmsLayer;

        get_warning_points(model, watershed, subbasin);

        wmsLayer2 = new ol.layer.Image({
            source: new ol.source.ImageWMS({
                //url: JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "")+'/wms',
                url: `https://geoserver.hydroshare.org/geoserver/${ wmsWorkspace }/wms`,
                params: {
                    'LAYERS':"Brazil_Stations_RT",
                    'SLD_BODY': style,
                },
                serverType: 'geoserver',
                crossOrigin: 'Anonymous'
            }),
            opacity: 0.7
        });
        feature_layer2 = wmsLayer2;

        map.addLayer(wmsLayer);
        map.addLayer(wmsLayer2);

        $loading.addClass('hidden');
        //var ajax_url = JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + '/' + workspace + '/' + watershed + '-' + subbasin + '-drainage_line/wfs?request=GetCapabilities';
        var ajax_url = 'https://geoserver.hydroshare.org/geoserver/wfs?request=GetCapabilities';

        var capabilities = $.ajax(ajax_url, {
            type: 'GET',
            data: {
                service: 'WFS',
                version: '1.0.0',
                request: 'GetCapabilities',
                outputFormat: 'text/javascript'
            },
            success: function() {
                var x = capabilities.responseText
                    .split('<FeatureTypeList>')[1]
                    //.split(workspace + ':' + watershed + '-' + subbasin)[1]
                    .split(`${ wmsWorkspace }:south_america-brazil-geoglows-drainage_line`)[1]
                    .split('LatLongBoundingBox ')[1]
                    .split('/></FeatureType>')[0];

                var minx = Number(x.split('"')[1]);
                var miny = Number(x.split('"')[3]);
                var maxx = Number(x.split('"')[5]);
                var maxy = Number(x.split('"')[7]);
                var extent = ol.proj.transform([minx, miny], 'EPSG:4326', 'EPSG:3857').concat(ol.proj.transform([maxx, maxy], 'EPSG:4326', 'EPSG:3857'));

                map.getView().fit(extent, map.getSize())
            }
        });

    } else {
        map.updateSize();
        //map.removeInteraction(select_interaction);
        map.removeLayer(wmsLayer);
        map.getView().fit(default_extent, map.getSize());
    }
}

function build_warning_points_layer(points, layer, periodFlowMapping = {}) {
    layer.getSource().clear();
    for (let i = 0; i < points.length; ++i) {
        const flow = points[i][4];
        const peaks = points[i][5];
        const coord = [ points[i][2], points[i][1] ];
        const geometry = new ol.geom.Point(
            ol.proj.transform(
                coord,
                'EPSG:4326',
                'EPSG:3857',
            ),
        );

        const feature = new ol.Feature({
            geometry: geometry,
            point_size: 40,
            comid: points[i][3],
            exceed: points[i][6],
            flow,
            peaks,
        });
        layer.getSource().addFeature(feature);
    }
}

function get_warning_points(model, watershed, subbasin) {
    $.ajax({
        type: 'GET',
        url: 'get-warning-points/',
        dataType: 'json',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin
        },
        error: function(error) {
            console.log(error);
        },
        success: function(result) {
            two_year_warning.getSource().clear();
            five_year_warning.getSource().clear();
            ten_year_warning.getSource().clear();
            twenty_five_year_warning.getSource().clear();
            fifty_year_warning.getSource().clear();
            hundred_year_warning.getSource().clear();

            [
                [ two_year_warning, 2 ],
                [ five_year_warning, 5 ],
                [ ten_year_warning, 10 ],
                [ twenty_five_year_warning, 25 ],
                [ fifty_year_warning, 50 ],
                [ hundred_year_warning, 100 ],
            ].forEach(([ layer, period ]) => {
                const points = result.filter((point) => point[0] === period);

                if (points.length === 0) { return; }

                build_warning_points_layer(
                    points,
                    layer,
                );
                layer.setVisible(false);
            });
        }
    });
}

function get_available_dates(model, watershed, subbasin, comid) {
    if (model === 'ECMWF-RAPID') {
        $.ajax({
            type: 'GET',
            url: 'get-available-dates/',
            dataType: 'json',
            data: {
                'watershed': watershed,
                'subbasin': subbasin,
                'comid': comid
            },
            error: function() {
                $('#dates').html(
                    '<p class="alert alert-danger" style="text-align: center"><strong>An error occurred while retrieving the available dates</strong></p>'
                );

                setTimeout(function() {
                    $('#dates').addClass('hidden')
                }, 5000);
            },
            success: function(dates) {
                datesParsed = JSON.parse(dates.available_dates);
                $('#datesSelect').empty();

                $.each(datesParsed, function(i, p) {
                    var val_str = p.slice(1).join();
                    $('#datesSelect').append($('<option></option>').val(val_str).html(p[0]));
                });

            }
        });
    }
}

function get_time_series(model, watershed, subbasin, comid, startdate) {
    $loading.removeClass('hidden');
    $('#long-term-chart').addClass('hidden');
    $('#dates').addClass('hidden');
    $.ajax({
        type: 'GET',
        url: 'get-time-series/',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        error: function() {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function() {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function(data) {
            if (!data.error) {
                $('#dates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#long-term-chart').removeClass('hidden');
                $('#long-term-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#long-term-chart .js-plotly-plot")[0]);

                get_forecast_percent(watershed, subbasin, comid, startdate);

                var params = {
                    watershed_name: watershed,
                    subbasin_name: subbasin,
                    reach_id: comid,
                    startdate: startdate,
                };

                $('#submit-download-forecast').attr({
                    target: '_blank',
                    href: 'get-forecast-data-csv?' + jQuery.param(params)
                });

                $('#download_forecast').removeClass('hidden');

            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
}

function get_historic_data(model, watershed, subbasin, comid, startdate) {
    $('#his-view-file-loading').removeClass('hidden');
    m_downloaded_historical_streamflow = true;
    $.ajax({
        type: 'GET',
        url: 'get-historic-data',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        error: console.log,
        success: function(data) {
            if (!data.error) {
                $('#his-view-file-loading').addClass('hidden');
                $('#historical-chart').removeClass('hidden');
                $('#historical-chart').html(data);

                var params = {
                    watershed_name: watershed,
                    subbasin_name: subbasin,
                    reach_id: comid,
                    daily: false
                };

                $('#submit-download-5-csv').attr({
                    target: '_blank',
                    href: 'get-historic-data-csv?' + jQuery.param(params)
                });

                $('#download_era_5').removeClass('hidden');

            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function get_flow_duration_curve(model, watershed, subbasin, comid, startdate) {
    $('#fdc-view-file-loading').removeClass('hidden');
    m_downloaded_flow_duration = true;
    $.ajax({
        type: 'GET',
        url: 'get-flow-duration-curve',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        success: function(data) {
            if (!data.error) {
                $('#fdc-view-file-loading').addClass('hidden');
                $('#fdc-chart').removeClass('hidden');
                $('#fdc-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function get_daily_seasonal_streamflow(model, watershed, subbasin, comid, startdate) {
    $('#seasonal_d-view-file-loading').removeClass('hidden');
    m_downloaded_flow_duration = true;
    $.ajax({
        type: 'GET',
        url: 'get-daily-seasonal-streamflow',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        success: function(data) {
            if (!data.error) {
                $('#seasonal_d-view-file-loading').addClass('hidden');
                $('#seasonal_d-chart').removeClass('hidden');
                $('#seasonal_d-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function get_monthly_seasonal_streamflow(model, watershed, subbasin, comid, startdate) {
    $('#seasonal_m-view-file-loading').removeClass('hidden');
    m_downloaded_flow_duration = true;
    $.ajax({
        type: 'GET',
        url: 'get-monthly-seasonal-streamflow',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        success: function(data) {
            if (!data.error) {
                $('#seasonal_m-view-file-loading').addClass('hidden');
                $('#seasonal_m-chart').removeClass('hidden');
                $('#seasonal_m-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function() {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function get_forecast_percent(watershed, subbasin, comid, startdate) {
    //$loading.removeClass('hidden');
    // $("#forecast-table").addClass('hidden');
    $.ajax({
        type: 'GET',
        url: 'forecastpercent/',
        data: {
            'watershed': watershed,
            'subbasin': subbasin,
            'comid': comid,
            'startdate': startdate
        },
        error: function(xhr, errmsg, err) {
            $('#table').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: "+errmsg+".</div>"); // add the error to the dom
			console.log(xhr.status + ": " + xhr.responseText); // provide a bit more info about the error to the console
        },
        success: function(resp) {
          // console.log(resp)
          $('#forecast-table').html(resp);

          $("#forecast-table").removeClass('hidden');

          $("#forecast-table").show();
          // $('#table').html(resp);

          var params = {
            watershed_name: watershed,
            subbasin_name: subbasin,
            reach_id: comid,
            startdate: startdate,
          };

          $('#submit-download-forecast-ens').attr({
            target: '_blank',
            href: 'get-forecast-ens-data-csv?' + jQuery.param(params)
          });

          $('#download_forecast_ens').removeClass('hidden');

        }
    });
}

function get_discharge_info (stationcode, stationname, startdateobs, enddateobs) {
    $('#observed-loading-Q').removeClass('hidden');
    $.ajax({
        url: 'get-discharge-data',
        type: 'GET',
        data: {'stationcode' : stationcode, 'stationname' : stationname, 'startdateobs' : startdateobs, 'enddateobs' : enddateobs},
        error: function () {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#observed-loading-Q').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#observed-chart-Q').removeClass('hidden');
                $('#observed-chart-Q').html(data);
                //resize main graph
                Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);

                var params = {
                    stationcode: stationcode,
                    stationname: stationname,
                };

                $('#submit-download-observed-discharge').attr({
                    target: '_blank',
                    href: 'get-observed-discharge-csv?' + jQuery.param(params)
                });

                $('#download_observed_discharge').removeClass('hidden');

                $('#submit-download-sensor-discharge').attr({
                    target: '_blank',
                    href: 'get-sensor-discharge-csv?' + jQuery.param(params)
                });

                $('#download_sensor_discharge').removeClass('hidden');

                } else if (data.error) {
                	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
                	$('#info').removeClass('hidden');

                	setTimeout(function() {
                    	$('#info').addClass('hidden')
                	}, 5000);
            	} else {
                	$('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            	}
            }
    })
}

function get_waterlevel_info (stationcode, stationname, startdateobs, enddateobs) {
    $('#observed-loading-WL').removeClass('hidden');
    $.ajax({
        url: 'get-waterlevel-data',
        type: 'GET',
        data: {'stationcode' : stationcode, 'stationname' : stationname, 'startdateobs' : startdateobs, 'enddateobs' : enddateobs},
        error: function () {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Water Level Data</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#observed-loading-WL').addClass('hidden');
                $('#dates').removeClass('hidden');
//                $('#obsdates').removeClass('hidden');
                $loading.addClass('hidden');
                $('#observed-chart-WL').removeClass('hidden');
                $('#observed-chart-WL').html(data);

                //resize main graph
                Plotly.Plots.resize($("#observed-chart-WL .js-plotly-plot")[0]);

                var params = {
                    stationcode: stationcode,
                    stationname: stationname,
                };

                $('#submit-download-observed-waterlevel').attr({
                    target: '_blank',
                    href: 'get-observed-waterlevel-csv?' + jQuery.param(params)
                });

                $('#download_observed_waterlevel').removeClass('hidden');

                $('#submit-download-sensor-waterlevel').attr({
                    target: '_blank',
                    href: 'get-sensor-waterlevel-csv?' + jQuery.param(params)
                });

                $('#download_sensor_waterlevel').removeClass('hidden');

                } else if (data.error) {
                	$('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
                	$('#info').removeClass('hidden');

                	setTimeout(function() {
                    	$('#info').addClass('hidden')
                	}, 5000);
            	} else {
                	$('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            	}
        }
    })
}

function getForViewAndSize(center, resolution, rotation, size) {
    var dx = resolution * size[0] / 2;
    var dy = resolution * size[1] / 2;
    var cosRotation = Math.cos(rotation);
    var sinRotation = Math.sin(rotation);
    var xCos = dx * cosRotation;
    var xSin = dx * sinRotation;
    var yCos = dy * cosRotation;
    var ySin = dy * sinRotation;
    var x = center[0];
    var y = center[1];
    var x0 = x - xCos + ySin;
    var x1 = x - xCos - ySin;
    var x2 = x + xCos - ySin;
    var x3 = x + xCos + ySin;
    var y0 = y - xSin - yCos;
    var y1 = y - xSin + yCos;
    var y2 = y + xSin + yCos;
    var y3 = y + xSin - yCos;
    return [
        Math.min(x0, x1, x2, x3), Math.min(y0, y1, y2, y3),
        Math.max(x0, x1, x2, x3), Math.max(y0, y1, y2, y3),
    ];
}

function map_events() {
    const warningLayers = [
        hundred_year_warning,
        fifty_year_warning,
        twenty_five_year_warning,
        ten_year_warning,
        five_year_warning,
        two_year_warning,
    ];

    map.on('pointermove', function(evt) {
        if (evt.dragging) {
            return;
        }
        var model = $('#model option:selected').text();
        var pixel = map.getEventPixel(evt.originalEvent);
        if (model === 'ECMWF-RAPID') {
            var hit = map.forEachLayerAtPixel(pixel, function(layer) {
                if (layer == feature_layer || layer == feature_layer2) {
                    current_layer = layer;
                    return true;
                }

                if (warningLayers.includes(layer)) {
                    current_layer = layer;
                    return true;
                }
            });
        }

        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    map.on("singleclick", function(evt) {
        var model = $('#model option:selected').text();

        if (map.getTargetElement().style.cursor == "pointer") {

            var view = map.getView();
            var viewResolution = view.getResolution();

            if (model === 'ECMWF-RAPID') {
                let wms_url;
                let current_layer_feature;

                if (warningLayers.includes(current_layer)) {
                    const pixel = map.getEventPixel(evt.originalEvent);
                    current_layer_feature = map.forEachFeatureAtPixel(pixel, (feature, layer) => {
                        if (layer !== current_layer) { return; }
                        return feature;
                    })

                    if (!current_layer_feature) { return; }

                    const coordinates = current_layer_feature.getGeometry().getCoordinates();
                    const bbox = getForViewAndSize(coordinates, viewResolution, 0, [101, 101]);
                    const x = Math.floor((coordinates[0] - bbox[0]) / viewResolution);
                    const y = Math.floor((bbox[3] - coordinates[1]) / viewResolution);

                    const url = new URL(JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "")+'wms');
                    url.searchParams.append('SERVICE', 'WMS');
                    url.searchParams.append('VERSION', '1.3.0');
                    url.searchParams.append('REQUEST', 'GetFeatureInfo');
                    url.searchParams.append('FORMAT', 'image/png');
                    url.searchParams.append('TRANSPARENT', 'true');
                    url.searchParams.append('QUERY_LAYERS', watershed_layer_name());
                    url.searchParams.append('LAYERS', watershed_layer_name());
                    url.searchParams.append('INFO_FORMAT', 'application/json');
                    url.searchParams.append('I', x);
                    url.searchParams.append('J', y);
                    url.searchParams.append('CRS', view.getProjection().getCode());
                    url.searchParams.append('WIDTH', 101);
                    url.searchParams.append('HEIGHT', 101);
                    url.searchParams.append('BBOX', bbox.join(','));
                    wms_url = url.href;
                } else {
                    wms_url = current_layer.getSource().getGetFeatureInfoUrl(evt.coordinate, viewResolution, view.getProjection(), { 'INFO_FORMAT': 'application/json' }); //Get the wms url for the clicked point
                }

                if (current_layer["H"]["source"]["i"]["LAYERS"] == "Brazil_Stations_RT") {
                $.ajax({
                    type: "GET",
                    url: wms_url,
                    dataType: 'json',
                    success: function (result) {
                        stationcode = result["features"][0]["properties"]["CodEstacao"];
                        stationname = result["features"][0]["properties"]["NomeEstaca"];
                        river = result["features"][0]["properties"]["NomeRio"]
                        altitude = result["features"][0]["properties"]["Altitude"];
                        locality = result["features"][0]["properties"]["Municipio_"];
                        
                        localization= result["features"][0]["geometry"]["coordinates"];
  
                        lon= result["features"][0]["geometry"]["coordinates"][0];
                        lat= result["features"][0]["geometry"]["coordinates"][1];
                               
                        $("#station-name-custom").append('<b>Name:</b>'+stationname);
                        $("#station-comid-custom").append('<b>Comid:</b>'+stationcode);
                        $("#station-river-custom").append('<b>River:</b>'+river);
                        $("#station-latitude-custom").append('<b>Latitude:</b>'+lat);
                        $("#station-longitude-custom").append('<b>Longitude:</b>'+lon);
                        $("#station-local-custom").append('<b>Locality:</b>'+locality);
                        $("#station-altitude-custom").append('<b>altitude:</b>'+altitude);

                    }
                });
                $("#info-Stations").modal('hide');
                $("#station-name-custom").empty()
                $("#station-comid-custom").empty()
                $("#station-river-custom").empty()
                $("#station-latitude-custom").empty()
                $("#station-longitude-custom").empty()
                $("#station-altitude-custom").empty()
                $("#station-local-custom").empty()
                $("#info-Stations").modal('show');
                $('#info-continue').off('click').on('click', () => {
                    $("#info-Stations").modal('hide');
                    $("#obsgraph").modal('show');
                    $('#observed-chart-Q').addClass('hidden');
                    $('#observed-chart-WL').addClass('hidden');
                    $('#obsdates').addClass('hidden');
                    $('#observed-loading-Q').removeClass('hidden');
                    $('#observed-loading-WL').removeClass('hidden');
                    $("#station-info").empty()
                    $('#download_observed_discharge').addClass('hidden');
                    $('#download_sensor_discharge').addClass('hidden');
                    $('#download_observed_waterlevel').addClass('hidden');
                    $('#download_sensor_waterlevel').addClass('hidden');

                    $.ajax({
                        type: "GET",
                        url: wms_url,
                        dataType: 'json',
                        success: function (result) {
                            stationcode = result["features"][0]["properties"]["CodEstacao"];
                            stationname = result["features"][0]["properties"]["NomeEstaca"];
                            $('#obsdates').removeClass('hidden');
                            var startdateobs = $('#startdateobs').val();
                            var enddateobs = $('#enddateobs').val();
                            $("#station-info").append('<h5>Current Station: '+ stationname + '</h5><h5>Station Code: '+ stationcode);
                            get_discharge_info (stationcode, stationname, startdateobs, enddateobs);
                            get_waterlevel_info (stationcode, stationname, startdateobs, enddateobs);

                        }
                    });
                })
            }

                //if (wms_url) {
                else {

                    $("#graph").modal('show');
                    $("#tbody").empty()
                    $('#long-term-chart').addClass('hidden');
                    $("#forecast-table").addClass('hidden');
                    $('#historical-chart').addClass('hidden');
                    $('#fdc-chart').addClass('hidden');
                    $('#seasonal_d-chart').addClass('hidden');
                    $('#seasonal_m-chart').addClass('hidden');
                    $('#download_forecast').addClass('hidden');
                    $('#download_era_5').addClass('hidden');

                    $loading.removeClass('hidden');
                    //Retrieving the details for clicked point via the url
                    $('#dates').addClass('hidden');
                    //$('#plot').addClass('hidden');

                    const onSuccess = (model, watershed, subbasin, comid) => {
                        const startdate = '';

                        if (model === 'ECMWF-RAPID') {
                            get_forecast_percent(watershed, subbasin, comid, startdate);
                        };

                        get_available_dates(model, watershed, subbasin, comid);
                        get_requestData (model, watershed, subbasin, comid, startdate);

                        var workspace = JSON.parse($('#geoserver_endpoint').val())[1];

                        $('#info').addClass('hidden');
                        add_feature(model, workspace, comid);
                    };

                    const geoserverEndpoint = JSON.parse($('#geoserver_endpoint').val())[2];
                    const model = $('#model option:selected').text();

                    if (geoserverEndpoint && warningLayers.includes(current_layer)) {
                        const watershed = geoserverEndpoint.split('-')[0]
                        const subbasin = geoserverEndpoint.split('-')[1];
                        onSuccess(model, watershed, subbasin, current_layer_feature.get('comid'));
                    } else {
                        $.ajax({
                            type: "GET",
                            url: wms_url,
                            dataType: 'json',
                            success: function(result) {
                                comid = result["features"][0]["properties"]["COMID"];
    
                                if ("derived_fr" in (result["features"][0]["properties"])) {
                                    var watershed = (result["features"][0]["properties"]["derived_fr"]).toLowerCase().split('-')[0];
                                    var subbasin = (result["features"][0]["properties"]["derived_fr"]).toLowerCase().split('-')[1];
                                } else if (JSON.parse($('#geoserver_endpoint').val())[2]) {
                                    var watershed = geoserverEndpoint.split('-')[0]
                                    var subbasin = geoserverEndpoint.split('-')[1]
                                } else {
                                    var watershed = (result["features"][0]["properties"]["watershed"]).toLowerCase();
                                    var subbasin = (result["features"][0]["properties"]["subbasin"]).toLowerCase();
                                }
    
                                onSuccess(model, watershed, subbasin, comid);
                            },
                            error: function(XMLHttpRequest, textStatus, errorThrown) {
                                console.log(Error);
                            }
                        });
                    }
                }



            }
        };
    });

}

function add_feature(model, workspace, comid) {
    map.removeLayer(featureOverlay);

    var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
    var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();

    if (model === 'ECMWF-RAPID') {
        var vectorSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: function(extent) {
                return JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + '/' + 'ows?service=wfs&' +
                    'version=2.0.0&request=getfeature&typename=' + workspace + ':' + watershed + '-' + subbasin + '-drainage_line' + '&CQL_FILTER=COMID=' + comid + '&outputFormat=application/json&srsname=EPSG:3857&' + ',EPSG:3857';
            },
            strategy: ol.loadingstrategy.bbox
        });

        featureOverlay = new ol.layer.Vector({
            source: vectorSource,
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#00BFFF',
                    width: 8
                })
            })
        });
        map.addLayer(featureOverlay);
        map.getLayers().item(5);

    }
}

function submit_model() {
    $('#model').on('change', function() {
        var base_path = location.pathname;

        if (base_path.includes('ecmwf-rapid')) {
            base_path = base_path.replace('/ecmwf-rapid', '');
        }

        if ($('#model option:selected').val() === 'ecmwf') {
            location.href = 'http://' + location.host + base_path + 'ecmwf-rapid/?model=ECMWF-RAPID';
        } else {
            location.href = 'http://' + location.host + base_path;
        }
    });
};

function resize_graphs() {
    $("#forecast_tab_link").click(function() {
        Plotly.Plots.resize($("#long-term-chart .js-plotly-plot")[0]);
    });

    $("#historical_tab_link").click(function() {
        if (m_downloaded_historical_streamflow) {
        	Plotly.Plots.resize($("#historical-chart .js-plotly-plot")[0]);
        }
    });

    $("#flow_duration_tab_link").click(function() {
        if (m_downloaded_flow_duration) {
            Plotly.Plots.resize($("#fdc-chart .js-plotly-plot")[0]);
            Plotly.Plots.resize($("#seasonal_d-chart .js-plotly-plot")[0]);
            Plotly.Plots.resize($("#seasonal_m-chart .js-plotly-plot")[0]);
        }
    });
    $("#observedQ_tab_link").click(function() {
        Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);
    });
    $("#observedWL_tab_link").click(function() {
        Plotly.Plots.resize($("#observed-chart-WL .js-plotly-plot")[0]);
    });
};

$(function() {
    $('#app-content-wrapper').removeClass('show-nav');
    $(".toggle-nav").removeClass('toggle-nav');

    //make sure active Plotly plots resize on window resize
    window.onresize = function() {
        $('#graph .modal-body .tab-pane.active .js-plotly-plot').each(function(){
            Plotly.Plots.resize($(this)[0]);
        });
    };

    init_map();
    map_events();
    submit_model();
    resize_graphs();
    // If there is a defined Watershed, then lets render it and hide the controls
    let ws_val = $('#watershed').find(":selected").text();
    if (ws_val && ws_val !== 'Select Watershed') {
        view_watershed();
        $("[name='update_button']").hide();
    }
    // If there is a button to save default WS, let's add handler
    $("[name='update_button']").click(() => {
        $.ajax({
            url: 'admin/setdefault',
            type: 'GET',
            dataType: 'json',
            data: {
                'ws_name': $('#model').find(":selected").text(),
                'model_name': $('#watershed').find(":selected").text()
            },
            success: function() {
                // Remove the set default button
                $("[name='update_button']").hide(500);
                console.log('Updated Defaults Successfully');
            }
        });
    })


    $('#datesSelect').change(function() { //when date is changed
    	//console.log($("#datesSelect").val());

        //var sel_val = ($('#datesSelect option:selected').val()).split(',');
        sel_val = $("#datesSelect").val()

        //var startdate = sel_val[0];
        var startdate = sel_val;
        startdate = startdate.replace("-","");
        startdate = startdate.replace("-","");

        //var watershed = sel_val[1];
        var watershed = 'south_america';

        //var subbasin = sel_val[2];
        var subbasin = 'geoglows';

        //var comid = sel_val[3];
        var model = 'ECMWF-RAPID';

        $loading.removeClass('hidden');
        get_time_series(model, watershed, subbasin, comid, startdate);
        //get_forecast_percent(watershed, subbasin, comid, startdate);
    });
    $('#startdateobs').change(function() { //when date is changed
        var startdateobs = $('#startdateobs').val();
        var enddateobs = $('#enddateobs').val();
        $('#observed-loading-Q').removeClass('hidden');
        $('#observed-loading-WL').removeClass('hidden');
        get_discharge_info (stationcode, stationname, startdateobs, enddateobs);
        get_waterlevel_info (stationcode, stationname, startdateobs, enddateobs);
    });
    $('#enddateobs').change(function() { //when date is changed
        var startdateobs = $('#startdateobs').val();
        var enddateobs = $('#enddateobs').val();
        $('#observed-loading-Q').removeClass('hidden');
        $('#observed-loading-WL').removeClass('hidden');
        get_discharge_info (stationcode, stationname, startdateobs, enddateobs);
        get_waterlevel_info (stationcode, stationname, startdateobs, enddateobs);
    });
});

function turnOffLayerGroup(map, layerGroup, except) {
    const layers = map.getLayers().getArray();

    for (let layer of layers) {
        if (layer.get('group') === layerGroup) {
            layer.setVisible(false);

            observedLayers
                .filter(({ group, layer }) => {
                    return group === layerGroup
                        && (except ? layer !== except : true);
                })
                .forEach((observed) => observed.isOn = false);
        }
    }
}

function removeLayer(map, layerName) {
    const layers = map.getLayers().getArray();

    for (let layer of layers) {
        if (layer.get('name') === layerName) {
            map.removeLayer(layer);
            break;
        }
    }
}

function zoomToLayer(layer) {
    if (layer.getVisible() === false) { return; }

    setTimeout(() => {
        const myExtent = layer.getSource().getExtent();
        map.getView().fit(myExtent, map.getSize());
    }, 10);
}

function createGeojsonsLayer(options) {
    const {
        staticGeoJson,
        geojsons,
        layerName,
        group,
        visible = true,
        style,
    } = options;

    for (let i in geojsons) {
        var regionsSource = new ol.source.Vector({
           url: staticGeoJson + geojsons[i],
           format: new ol.format.GeoJSON()
        });

        var regionsLayer = new ol.layer.Vector({
            group,
            name: layerName || 'myRegion',
            source: regionsSource,
            style,
            visible,
        });

        map.addLayer(regionsLayer)

        setTimeout(() => zoomToLayer(regionsLayer), 500);

        return regionsLayer;
    }
}

function activateGeojsons(geojsons, layerName, group) {
    for (let i in geojsons) {
        var regionsSource = new ol.source.Vector({
           url: staticGeoJSON + geojsons[i],
           format: new ol.format.GeoJSON()
        });

        var featureStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#009C3B',
                width: 3
            })
        });

        var regionsLayer = new ol.layer.Vector({
            group,
            name: layerName || 'myRegion',
            source: regionsSource,
            style: featureStyle,
        });

        removeLayer(map, layerName || 'myRegion');
        map.addLayer(regionsLayer)

        setTimeout(function() {
            var myExtent = regionsLayer.getSource().getExtent();
            map.getView().fit(myExtent, map.getSize());
        }, 500);
    }
}

function getRegionGeoJsons() {
    let geojsons = region_index[$("#regions").val()]['geojsons'];
    activateGeojsons(geojsons, 'myRegion');
}

function getBasinGeoJsons() {
    let geojsons = region_index[$("#basins").val()]['geojsons'];
    activateGeojsons(geojsons, 'myRegion');
}

function getSubBasinGeoJsons() {
    let geojsons = region_index[$("#subbasins").val()]['geojsons'];
    activateGeojsons(geojsons, 'myRegion');
}

// Regions gizmo listener
$('#regions').change(function() {getRegionGeoJsons()});
$('#basins').change(function() {getBasinGeoJsons()});
$('#subbasins').change(function() {getSubBasinGeoJsons()});
