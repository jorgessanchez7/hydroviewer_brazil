/* Global Variables */
let wmsStreamsLayer,
    wmsStationsLayer,
    stationsData = [],
    streamsData = [],
    wmsStreamsGroupLayer,
    wmsStationsGroupLayer,
    wmsAccumulatedRainfallLayer,
    wmsRainfallProbability50Layer,
    wmsRainfallProbability150Layer,
    wmsRainfallProbability300Layer,
    twoYearWarningLayer,
    fiveYearWarningLayer,
    tenYearWarningLayer,
    twentyFiveYearWarningLayer,
    fiftyYearWarningLayer,
    hundredYearWarningLayer,
    regionsLayerGroup,
    ottobaciasLayerGroup,
    rainfallWarningsLayerGroup;

const REGIONS_LAYER_GROUP = 'regions_layer_group';
const OTTOBACIAS_LAYER_GROUP = "ottobacias_layer_group";

const loadingComponent = $('#view-file-loading');

const glofasURL = 'http://globalfloods-ows.ecmwf.int/glofas-ows/ows.py'
let observedLayers = [];

const stationsPopupId = 'info-stations-popup';

// Main entry point for the WMS. 
// 
// Once all the DOM elements are loaded and ready to be used, this will be called 
// to set up all of the map's features.
$(function () {
    $('#app-content-wrapper').removeClass('show-nav');
    $(".toggle-nav").removeClass('toggle-nav');

    //make sure active Plotly plots resize on window resize
    window.onresize = function () {
        $('#graph .modal-body .tab-pane.active .js-plotly-plot').each(function () {
            Plotly.Plots.resize($(this)[0]);
        });
    };

    initMap();
    initWarningLayers();
    submitModel();

    // If there is a defined Watershed, then lets render it and hide the controls
    let ws_val = $('#watershed').find(":selected").text();
    if (ws_val && ws_val !== 'Select Watershed') {
        viewWatershed();
        $("[name='update_button']").hide();
    }

    registerCallbacks();

    buildOverlays();

    loadData();
});

/***
 * Initializes the map and all of the layers required to draw data in.
*/
function initMap() {
    const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 2,
        maxZoom: 18,
    });

    var lon = Number(JSON.parse($('#zoom_info').val()).split(',')[0]);
    var lat = Number(JSON.parse($('#zoom_info').val()).split(',')[1]);
    var zoomLevel = Number(JSON.parse($('#zoom_info').val()).split(',')[2]);

    map = L.map('map', {
        center: [lat, lon],
        zoom: zoomLevel,
        layers: [baseLayer]
    });

    L.control.zoom(2);

    regionsLayerGroup = L.layerGroup([]).addTo(map);
    ottobaciasLayerGroup = L.layerGroup([]).addTo(map);
}

function initWarningLayers() {
    if (!map.getPane(WARNINGS)) {
        map.createPane(WARNINGS)
    }

    twoYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);
    fiveYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);
    tenYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);
    twentyFiveYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);
    fiftyYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);
    hundredYearWarningLayer = L.geoJSON(null, { pane: WARNINGS }).addTo(map);

    map.addLayer(twoYearWarningLayer);
    map.addLayer(fiveYearWarningLayer);
    map.addLayer(tenYearWarningLayer);
    map.addLayer(twentyFiveYearWarningLayer);
    map.addLayer(fiftyYearWarningLayer);
    map.addLayer(hundredYearWarningLayer);
}

function submitModel() {
    $('#model').on('change', function () {
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
}

function viewWatershed() {
    if (wmsStreamsLayer) {
        map.removeLayer(wmsStreamsLayer);
    }

    $("#get-started").modal('hide');

    if ($('#model option:selected').text() === 'ECMWF-RAPID' && $('#watershedSelect option:selected').val() !== "") {
        $("#watershed-info").empty();

        $('#dates').addClass('hidden');

        var model = $('#model option:selected').text();
        var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
        var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();
        var watershed_display_name = $('#watershedSelect option:selected').text().split(' (')[0];
        var subbasin_display_name = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '');
        $("#watershed-info").append('<h3>Current Watershed: ' + watershed_display_name + '</h3><h5>Subbasin Name: ' + subbasin_display_name);

        getWarningPoints(model, watershed, subbasin);

        wmsStreamsGroupLayer = L.layerGroup([]).addTo(map);
        wmsStationsGroupLayer = L.layerGroup([]).addTo(map);

        loadingComponent.addClass('hidden');
    }
}

function getWarningPoints(model, watershed, subbasin) {
    $.ajax({
        type: 'GET',
        url: 'get-warning-points/',
        dataType: 'json',
        data: {
            'model': model,
            'watershed': watershed,
            'subbasin': subbasin
        },
        error: function (error) {
            console.log(error);
        },
        success: function (result) {
            twoYearWarningLayer.clearLayers()
            fiveYearWarningLayer.clearLayers()
            tenYearWarningLayer.clearLayers()
            twentyFiveYearWarningLayer.clearLayers()
            fiftyYearWarningLayer.clearLayers()
            hundredYearWarningLayer.clearLayers()

            const warningLayers = [
                [twoYearWarningLayer, 2],
                [fiveYearWarningLayer, 5],
                [tenYearWarningLayer, 10],
                [twentyFiveYearWarningLayer, 25],
                [fiftyYearWarningLayer, 50],
                [hundredYearWarningLayer, 100]
            ]

            warningLayers.forEach(([layer, period]) => {
                const points = result.filter((point) => point[0] === period);

                if (points.length === 0) return;
               
                buildWarningPointsLayer(points, layer, period);
            });
        }
    });
}

function registerCallbacks() {
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
            success: function () {
                // Remove the set default button
                $("[name='update_button']").hide(500);
                console.log('Updated Defaults Successfully');
            }
        });
    })

    $('#datesSelect').change(function () { //when date is changed
        sel_val = $("#datesSelect").val()

        var startdate = sel_val;
        startdate = startdate.replace("-", "");
        startdate = startdate.replace("-", "");

        var watershed = 'south_america';

        var subbasin = 'geoglows';

        var model = 'ECMWF-RAPID';

        loadingComponent.removeClass('hidden');
        getTimeSeries(model, watershed, subbasin, comid, startdate);
    });

    $('#startdateobs').change(function () { //when date is changed
        var startdateobs = $('#startdateobs').val();
        var enddateobs = $('#enddateobs').val();
        $('#observed-loading-Q').removeClass('hidden');
        $('#observed-loading-WL').removeClass('hidden');
        $('#corrected-loading-WL').removeClass('hidden');

        get_discharge_info(stationcode, stationname, startdateobs, enddateobs);
        get_waterlevel_info(stationcode, stationname, startdateobs, enddateobs);
        get_stations(stationcode, stationname);
    });

    $('#enddateobs').change(function () { //when date is changed
        var startdateobs = $('#startdateobs').val();
        var enddateobs = $('#enddateobs').val();
        $('#observed-loading-Q').removeClass('hidden');
        $('#observed-loading-WL').removeClass('hidden');
        $('#corrected-loading-WL').removeClass('hidden');

        get_discharge_info(stationcode, stationname, startdateobs, enddateobs);
        get_waterlevel_info(stationcode, stationname, startdateobs, enddateobs);
        get_stations(stationcode, stationname);

    });
}

async function loadStationsData() {
    const response = await fetch("get-all-stations")

    if (response.status === 200) {
        const json = await response.json()
        stationsData = json.stations
    } else {
        console.error("Error while loading stations data:\n\n", response.statusText);
    }

    updateLoadingStatus(STATIONS, false)
}

async function loadStreamsData() {
    const response = await fetch("get-all-streams")

    if (response.status === 200) {
        const json = await response.json()

        streamsData = json.streams
    } else {
        console.error("Error while loading streams data:\n\n", response.statusText);
    }

    updateLoadingStatus(STREAMS, false)
}

async function getStationData(id) {
    const response = await fetch(`get-station?stationCode=${id}`)

    if (response.status === 200) {
        const json = await response.json()

        buildStationModal(json)
    } else {
        console.error("Error while loading stations data:\n\n", response.statusText);
    }
}

function updateLoadingStatus(key, isLoading) {
    const collection = document.getElementsByClassName('common-option-wrapper');

    for (let item of collection) {
        if (item.children[0].textContent.toLocaleLowerCase().includes(key)) {
            if (isLoading) {
                item.classList.add('loading')
                item.children[2].classList.add('loading')
            } else {
                item.classList.remove('loading')
                item.children[2].classList.remove('loading')
            }
        }
    }
}

async function loadData() {
    updateLoadingStatus(STREAMS, true)
    updateLoadingStatus(STATIONS, true)

    await loadStationsData();
    await loadStreamsData();
}

function getRequestData(model, watershed, subbasin, comid, startdate) {
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
        error: function () {
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
            getTimeSeries(model, watershed, subbasin, comid, startdate);
            getHistoricData(model, watershed, subbasin, comid, startdate);
            getFlowDurationCurve(model, watershed, subbasin, comid, startdate);
            getDailySeasonalStreamflow(model, watershed, subbasin, comid, startdate);
            getMonthlySeasonalStreamflow(model, watershed, subbasin, comid, startdate);
        }
    })
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

function get_time_series(model, watershed, subbasin, comid, startdate) {
    loadingComponent.removeClass('hidden');
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
                loadingComponent.addClass('hidden');
                $('#long-term-chart').removeClass('hidden');
                $('#long-term-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#long-term-chart .js-plotly-plot")[0]);

                get_forecast_percent(watershed, subbasin, comid, startdate);
                loadingComponent.addClass('hidden');

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
            // console.log('success', data)
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

function watershedLayerName() {
    var workspace = JSON.parse($('#geoserver_endpoint').val())[1];
    var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
    var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();

    return workspace + ':' + watershed + '-' + subbasin + '-geoglows-drainage_line';
}

function getAvailableDates(model, watershed, subbasin, comid) {
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
            error: function () {
                $('#dates').html(
                    '<p class="alert alert-danger" style="text-align: center"><strong>An error occurred while retrieving the available dates</strong></p>'
                );

                setTimeout(function () {
                    $('#dates').addClass('hidden')
                }, 5000);
            },
            success: function (dates) {
                datesParsed = JSON.parse(dates.available_dates);
                $('#datesSelect').empty();

                $.each(datesParsed, function (i, p) {
                    var val_str = p.slice(1).join();
                    $('#datesSelect').append($('<option></option>').val(val_str).html(p[0]));
                });

            }
        });
    }
}



function getTimeSeries(model, watershed, subbasin, comid, startdate) {
    loadingComponent.removeClass('hidden');
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
        error: function () {
            $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the forecast</strong></p>');
            $('#info').removeClass('hidden');

            setTimeout(function () {
                $('#info').addClass('hidden')
            }, 5000);
        },
        success: function (data) {
            if (!data.error) {
                $('#dates').removeClass('hidden');
                loadingComponent.addClass('hidden');
                $('#long-term-chart').removeClass('hidden');
                $('#long-term-chart').html(data);

                //resize main graph
                Plotly.Plots.resize($("#long-term-chart .js-plotly-plot")[0]);

                getForecastPercent(watershed, subbasin, comid, startdate);

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

                setTimeout(function () {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
}

function getHistoricData(model, watershed, subbasin, comid, startdate) {
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
        success: function (data) {
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

                setTimeout(function () {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function getFlowDurationCurve(model, watershed, subbasin, comid, startdate) {
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
        success: function (data) {
            if (!data.error) {
                $('#fdc-view-file-loading').addClass('hidden');
                $('#fdc-chart').removeClass('hidden');
                $('#fdc-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function () {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function getDailySeasonalStreamflow(model, watershed, subbasin, comid, startdate) {
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
        success: function (data) {
            if (!data.error) {
                $('#seasonal_d-view-file-loading').addClass('hidden');
                $('#seasonal_d-chart').removeClass('hidden');
                $('#seasonal_d-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function () {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function getMonthlySeasonalStreamflow(model, watershed, subbasin, comid, startdate) {
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
        success: function (data) {
            if (!data.error) {
                $('#seasonal_m-view-file-loading').addClass('hidden');
                $('#seasonal_m-chart').removeClass('hidden');
                $('#seasonal_m-chart').html(data);
            } else if (data.error) {
                $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the historic data</strong></p>');
                $('#info').removeClass('hidden');

                setTimeout(function () {
                    $('#info').addClass('hidden')
                }, 5000);
            } else {
                $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
            }
        }
    });
};

function getForecastPercent(watershed, subbasin, comid, startdate) {
    //loadingComponent.removeClass('hidden');
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
        error: function (xhr, errmsg, err) {
            $('#table').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: " + errmsg + ".</div>"); // add the error to the dom
            console.log(xhr.status + ": " + xhr.responseText); // provide a bit more info about the error to the console
        },
        success: function (resp) {
            $('#forecast-table').html(resp);

            $("#forecast-table").removeClass('hidden');

            $("#forecast-table").show();
            // $('#table').html(resp);
            loadingComponent.addClass('hidden');

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

function get_forecast_percent(watershed, subbasin, comid, startdate) {
    //$loading.removeClass('hidden');
    // $("#forecast-table").addClass('hidden');
    loadingComponent.removeClass('hidden');
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
          loadingComponent.addClass('hidden');

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

// function get_discharge_info(stationcode, stationname, startdateobs, enddateobs) {
//     $('#observed-loading-Q').removeClass('hidden');
//     $.ajax({
//         url: 'get-discharge-data',
//         type: 'GET',
//         data: { 'stationcode': stationcode, 'stationname': stationname, 'startdateobs': startdateobs, 'enddateobs': enddateobs },
//         error: function () {
//             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//             $('#info').removeClass('hidden');

//             setTimeout(function () {
//                 $('#info').addClass('hidden')
//             }, 5000);
//         },
//         success: function (data) {
//             if (!data.error) {
//                 $('#observed-loading-Q').addClass('hidden');
//                 $('#dates').removeClass('hidden');
//                 //                $('#obsdates').removeClass('hidden');
//                 loadingComponent.addClass('hidden');
//                 $('#observed-chart-Q').removeClass('hidden');
//                 $('#observed-chart-Q').html(data);
//                 //resize main graph
//                 Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);

//                 var params = {
//                     stationcode: stationcode,
//                     stationname: stationname,
//                 };

//                 $('#submit-download-observed-discharge').attr({
//                     target: '_blank',
//                     href: 'get-observed-discharge-csv?' + jQuery.param(params)
//                 });

//                 $('#download_observed_discharge').removeClass('hidden');

//                 $('#submit-download-sensor-discharge').attr({
//                     target: '_blank',
//                     href: 'get-sensor-discharge-csv?' + jQuery.param(params)
//                 });

//                 $('#download_sensor_discharge').removeClass('hidden');

//             } else if (data.error) {
//                 $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//                 $('#info').removeClass('hidden');

//                 setTimeout(function () {
//                     $('#info').addClass('hidden')
//                 }, 5000);
//             } else {
//                 $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
//             }
//         }
//     })
// }

// function get_waterlevel_info(stationcode, stationname, startdateobs, enddateobs) {
//     $('#observed-loading-WL').removeClass('hidden');
//     $.ajax({
//         url: 'get-waterlevel-data',
//         type: 'GET',
//         data: { 'stationcode': stationcode, 'stationname': stationname, 'startdateobs': startdateobs, 'enddateobs': enddateobs },
//         error: function () {
//             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Water Level Data</strong></p>');
//             $('#info').removeClass('hidden');

//             setTimeout(function () {
//                 $('#info').addClass('hidden')
//             }, 5000);
//         },
//         success: function (data) {
//             if (!data.error) {
//                 $('#observed-loading-WL').addClass('hidden');
//                 $('#dates').removeClass('hidden');
//                 //                $('#obsdates').removeClass('hidden');
//                 loadingComponent.addClass('hidden');
//                 $('#observed-chart-WL').removeClass('hidden');
//                 $('#observed-chart-WL').html(data);

//                 //resize main graph
//                 Plotly.Plots.resize($("#observed-chart-WL .js-plotly-plot")[0]);

//                 var params = {
//                     stationcode: stationcode,
//                     stationname: stationname,
//                 };

//                 $('#submit-download-observed-waterlevel').attr({
//                     target: '_blank',
//                     href: 'get-observed-waterlevel-csv?' + jQuery.param(params)
//                 });

//                 $('#download_observed_waterlevel').removeClass('hidden');

//                 $('#submit-download-sensor-waterlevel').attr({
//                     target: '_blank',
//                     href: 'get-sensor-waterlevel-csv?' + jQuery.param(params)
//                 });

//                 $('#download_sensor_waterlevel').removeClass('hidden');

//             } else if (data.error) {
//                 $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//                 $('#info').removeClass('hidden');

//                 setTimeout(function () {
//                     $('#info').addClass('hidden')
//                 }, 5000);
//             } else {
//                 $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
//             }
//         }
//     })
// }


// function get_stations(stationcode, stationname) {
//     $('#corrected-loading-WL').removeClass('hidden');
//     $.ajax({
//         url: 'get-stations',
//         type: 'GET',
//         data: { 'stationcode': stationcode, 'stationname': stationname },
//         error: function () {
//             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Water Level Data</strong></p>');
//             $('#info').removeClass('hidden');

//             setTimeout(function () {
//                 $('#info').addClass('hidden')
//             }, 5000);
//         },
//         success: function (data) {
//             if (!data.error) {
//                 $('#corrected-loading-WL').addClass('hidden');
//                 $('#dates').removeClass('hidden');
//                 //                $('#obsdates').removeClass('hidden');
//                 loadingComponent.addClass('hidden');
//                 $('#corrected-chart-WL').removeClass('hidden');
//                 $('#corrected-chart-WL').html(data);

//                 //resize main graph
//                 Plotly.Plots.resize($("#corrected-chart-WL .js-plotly-plot")[0]);

//                 var params = {
//                     stationcode: stationcode,
//                     stationname: stationname,
//                 };

//                 $('#submit-download-corrected-waterlevel').attr({
//                     target: '_blank',
//                     href: 'get-corrected-waterlevel-csv?' + jQuery.param(params)
//                 });

//                 $('#download_corrected_waterlevel').removeClass('hidden');

//                 $('#submit-download-sensor-waterlevel').attr({
//                     target: '_blank',
//                     href: 'get-sensor-waterlevel-csv?' + jQuery.param(params)
//                 });

//                 $('#download_sensor_waterlevel').removeClass('hidden');

//             } else if (data.error) {
//                 $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//                 $('#info').removeClass('hidden');

//                 setTimeout(function () {
//                     $('#info').addClass('hidden')
//                 }, 5000);
//             } else {
//                 $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
//             }
//         }
//     });
// }

// function getForViewAndSize(center, resolution, rotation, size) {
// //function getForViewAndSize(center, rotation, size) {
//     // var dx = resolution * size[0] / 2;
//     // var dy = resolution * size[1] / 2;
//     var dx = size[0] / 2;
//     var dy = size[1] / 2;
//     var cosRotation = Math.cos(rotation);
//     var sinRotation = Math.sin(rotation);
//     var xCos = dx * cosRotation;
//     var xSin = dx * sinRotation;
//     var yCos = dy * cosRotation;
//     var ySin = dy * sinRotation;
//     var x = center[0];
//     var y = center[1];
//     var x0 = x - xCos + ySin;
//     var x1 = x - xCos - ySin;
//     var x2 = x + xCos - ySin;
//     var x3 = x + xCos + ySin;
//     var y0 = y - xSin - yCos;
//     var y1 = y - xSin + yCos;
//     var y2 = y + xSin + yCos;
//     var y3 = y + xSin - yCos;

//     return [
//         Math.min(x0, x1, x2, x3), Math.min(y0, y1, y2, y3),
//         Math.max(x0, x1, x2, x3), Math.max(y0, y1, y2, y3),
//     ];
// }

function getForViewAndSize(center, rotation, size) {
    var dx =  size[0] / 2;
    var dy =  size[1] / 2;
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


function addFeature(model, workspace, comid) {
    // map.removeLayer(featureOverlay);

    // var watershed = $('#watershedSelect option:selected').text().split(' (')[0].replace(' ', '_').toLowerCase();
    // var subbasin = $('#watershedSelect option:selected').text().split(' (')[1].replace(')', '').toLowerCase();

    // if (model === 'ECMWF-RAPID') {
    //     var vectorSource = new ol.source.Vector({
    //         format: new ol.format.GeoJSON(),
    //         url: function (extent) {
    //             return JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + '/' + 'ows?service=wfs&' +
    //                 'version=2.0.0&request=getfeature&typename=' + workspace + ':' + watershed + '-' + subbasin + '-drainage_line' + '&CQL_FILTER=COMID=' + comid + '&outputFormat=application/json&srsname=EPSG:3857&' + ',EPSG:3857';
    //         },
    //         strategy: ol.loadingstrategy.bbox
    //     });

    //     featureOverlay = new ol.layer.Vector({
    //         source: vectorSource,
    //         style: new ol.style.Style({
    //             stroke: new ol.style.Stroke({
    //                 color: '#00BFFF',
    //                 width: 8
    //             })
    //         })
    //     });
    //     map.addLayer(featureOverlay);
    //     map.getLayers().item(5);
    // }
}

// function removeLayer(map, layerName) {
//     const layers = map.getLayers().getArray();

//     for (let layer of layers) {
//         if (layer.get('name') === layerName) {
//             map.removeLayer(layer);
//             break;
//         }
//     }
// }

// function activateGeojsons(geojsons, layerName, group) {
//     for (let i in geojsons) {
//         var regionsSource = new ol.source.Vector({
//             url: staticGeoJSON + geojsons[i],
//             format: new ol.format.GeoJSON()
//         });

//         var featureStyle = new ol.style.Style({
//             stroke: new ol.style.Stroke({
//                 color: '#009C3B',
//                 width: 3
//             })
//         });

//         var regionsLayer = new ol.layer.Vector({
//             group,
//             name: layerName || 'myRegion',
//             source: regionsSource,
//             style: featureStyle,
//         });

//         removeLayer(map, layerName || 'myRegion');
//         map.addLayer(regionsLayer)

//         setTimeout(function () {
//             var myExtent = regionsLayer.getSource().getExtent();
//             map.getView().fit(myExtent, map.getSize());
//         }, 500);
//     }
// }

// function getRegionGeoJsons() {
//     let geojsons = region_index[$("#regions").val()]['geojsons'];
//     activateGeojsons(geojsons, 'myRegion');
// }

// function getBasinGeoJsons() {
//     let geojsons = region_index[$("#basins").val()]['geojsons'];
//     activateGeojsons(geojsons, 'myRegion');
// }

// function getSubBasinGeoJsons() {
//     let geojsons = region_index[$("#subbasins").val()]['geojsons'];
//     activateGeojsons(geojsons, 'myRegion');
// }

// // Regions gizmo listener
// $('#regions').change(function () { getRegionGeoJsons() });
// $('#basins').change(function () { getBasinGeoJsons() });
// $('#subbasins').change(function () { getSubBasinGeoJsons() });


