function buildStationChart(station) {
    stationCode = station._id;
    // stationCode = result["features"][0]["properties"]["CodEstacao"];
    // stationname = result["features"][0]["properties"]["NomeEstaca"];
    // $('#obsdates').removeClass('hidden');
    // var startdateobs = $('#startdateobs').val();
    // var enddateobs = $('#enddateobs').val();
    // $("#station-info").append('<h5>Current Station: ' + stationname + '</h5><h5>Station Code: ' + stationcode);
    // get_discharge_info(stationcode, stationname, startdateobs, enddateobs);
    // get_waterlevel_info(stationcode, stationname, startdateobs, enddateobs);
    // get_stations(stationcode, stationname);

    //buildHistoricalObserverdDischargeChart(station);
    // getDischargeData(stationCode);
    //buildHistoricalWaterLevelChart(station);
    // getWaterLevelData(stationCode);

    buildBiasCorrectionChart(station);
}

// TODO
// function getDischargeData(stationCode, stationName, startDate, endDate) {
// $('#observed-loading-Q').removeClass('hidden');

// $.ajax({
//     url: 'get-discharge-data',
//     type: 'GET',
//     data: { 'stationCode': stationCode },
//     // data: { 'stationCode': stationCode, 'stationName': stationName, 'startDate': startDate, 'endDate': endDate },
//     error: function () {
//         console.log("<debug> getDischargeData - error!");
//         // $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//         // $('#info').removeClass('hidden');

//         // setTimeout(function () {
//         //     $('#info').addClass('hidden')
//         // }, 5000);
//     },
//     success: function (data) {
//         console.log("<debug> getDischargeData - data: ", data);

//         if (!data.error) {
//             //     $('#observed-loading-Q').addClass('hidden');
//             //     $('#dates').removeClass('hidden');
//             //     //                $('#obsdates').removeClass('hidden');
//             //     loadingComponent.addClass('hidden');
//             //     $('#observed-chart-Q').removeClass('hidden');
//             //     $('#observed-chart-Q').html(data);
//             //     //resize main graph
//             //     Plotly.Plots.resize($("#observed-chart-Q .js-plotly-plot")[0]);

//             //     var params = {
//             //         stationcode: stationcode,
//             //         stationname: stationname,
//             //     };

//             //     $('#submit-download-observed-discharge').attr({
//             //         target: '_blank',
//             //         href: 'get-observed-discharge-csv?' + jQuery.param(params)
//             //     });

//             //     $('#download_observed_discharge').removeClass('hidden');

//             //     $('#submit-download-sensor-discharge').attr({
//             //         target: '_blank',
//             //         href: 'get-sensor-discharge-csv?' + jQuery.param(params)
//             //     });

//             //     $('#download_sensor_discharge').removeClass('hidden');
//         } else if (data.error) {
//             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//             $('#info').removeClass('hidden');

//             setTimeout(function () {
//                 $('#info').addClass('hidden')
//             }, 5000);
//         } else {
//             //     $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
//         }
//     }
// })
// }

// TODO
// function getWaterLevelData(stationCode, stationname, startdateobs, enddateobs) {
// $('#observed-loading-WL').removeClass('hidden');

// $.ajax({
//     url: 'get-waterlevel-data',
//     type: 'GET',
//     data: { 'stationCode': stationCode },
//     // data: { 'stationCode': stationCode, 'stationname': stationname, 'startdateobs': startdateobs, 'enddateobs': enddateobs },
//     error: function () {
//         console.log("<debug> getWaterLevelData - error!");
//         //             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Water Level Data</strong></p>');
//         //             $('#info').removeClass('hidden');

//         //             setTimeout(function () {
//         //                 $('#info').addClass('hidden')
//         //             }, 5000);
//     },
//     success: function (data) {
//         console.log("<debug> getWaterLevelData - data: ", data);

//         if (!data.error) {
//             //                 $('#observed-loading-WL').addClass('hidden');
//             //                 $('#dates').removeClass('hidden');
//             //                 //                $('#obsdates').removeClass('hidden');
//             //                 loadingComponent.addClass('hidden');
//             //                 $('#observed-chart-WL').removeClass('hidden');
//             //                 $('#observed-chart-WL').html(data);

//             //                 //resize main graph
//             //                 Plotly.Plots.resize($("#observed-chart-WL .js-plotly-plot")[0]);

//             //                 var params = {
//             //                     stationcode: stationcode,
//             //                     stationname: stationname,
//             //                 };

//             //                 $('#submit-download-observed-waterlevel').attr({
//             //                     target: '_blank',
//             //                     href: 'get-observed-waterlevel-csv?' + jQuery.param(params)
//             //                 });

//             //                 $('#download_observed_waterlevel').removeClass('hidden');

//             //                 $('#submit-download-sensor-waterlevel').attr({
//             //                     target: '_blank',
//             //                     href: 'get-sensor-waterlevel-csv?' + jQuery.param(params)
//             //                 });

//             //                 $('#download_sensor_waterlevel').removeClass('hidden');
//         } else if (data.error) {
//             $('#info').html('<p class="alert alert-danger" style="text-align: center"><strong>An unknown error occurred while retrieving the Discharge Data</strong></p>');
//             $('#info').removeClass('hidden');

//             setTimeout(function () {
//                 $('#info').addClass('hidden')
//             }, 5000);
//         } else {
//             //                 $('#info').html('<p><strong>An unexplainable error occurred.</strong></p>').removeClass('hidden');
//         }
//     }
// })
// }

function buildHistoricalObserverdDischargeChart(station) {
    $("#observed-chart-Q").empty();
    $("#observed-chart-Q").append(`<canvas id="myChartObserverdDischarge" width="400" height="200"></canvas>`);

    buildChart({
        chartId: 'myChartObserverdDischarge',
        datasets: [
            {
                label: 'Observed Discharge',
                data: station.Qobs
            }
        ],
        labels: station.Date.map(date => dayjs(date).format('MMM YYYY'))
    })

    var params = {
        stationcode: station._id,
        stationname: station.Name,
    };

    $('#submit-download-observed-discharge').attr({
        target: '_blank',
        // TODO: move to real endpoint once it comes back online
        href: 'get-historical-observed-discharge-csv?' + jQuery.param(params)
        // href: 'get-observed-discharge-csv?' + jQuery.param(params)
    });

    $('#download_observed_discharge').removeClass('hidden');

    $('#submit-download-sensor-discharge').attr({
        target: '_blank',
        href: 'get-sensor-discharge-csv?' + jQuery.param(params)
    });

    $('#download_sensor_discharge').removeClass('hidden');
}

function buildHistoricalWaterLevelChart(station) {
    $("#observed-chart-WL").empty();
    $("#observed-chart-WL").append(`<canvas id="myChartWaterLevel" width="400" height="200"></canvas>`);

    buildChart({
        chartId: 'myChartWaterLevel',
        datasets: [
            {
                label: 'Observed Water Level',
                data: station.QGlofas
            }
        ],
        labels: station.Date.map(date => dayjs(date).format('MMM YYYY'))
    })

    var params = {
        stationcode: station._id,
        stationname: station.Name,
    };

    $('#submit-download-observed-waterlevel').attr({
        target: '_blank',
        // TODO: move to real endpoint once it comes back online
        href: 'get-historical-observed-waterlevel-csv?' + jQuery.param(params)
        // href: 'get-observed-waterlevel-csv?' + jQuery.param(params)
    });

    $('#download_observed_waterlevel').removeClass('hidden');

    $('#submit-download-sensor-waterlevel').attr({
        target: '_blank',
        href: 'get-sensor-waterlevel-csv?' + jQuery.param(params)
    });

    $('#download_sensor_waterlevel').removeClass('hidden');
}

function buildBiasCorrectionChart(station) {
    // Clear the previous chart
    $("#corrected-chart-WL").empty();

    // Create a div element for the Plotly chart
    $("#corrected-chart-WL").append('<div id="biasCorrectionChart" style="width:100%; height:100%;"></div>');

    // Convert and validate dates to ISO format (YYYY-MM-DD)
    const isoDates = station.Date.map(date => {
        const d = new Date(date);
        return d.toISOString().split('T')[0]; // Converts to 'YYYY-MM-DD' format
    });
    
    // Prepare the data for the chart
    const data = [
        {
            x: isoDates,
            y: station.Qobs,
            mode: 'lines',
            name: 'Observed',
            line: { shape: 'spline' }
        },
        {
            x: isoDates,
            y: station.QGlofas,
            mode: 'lines',
            name: 'Glofas',
            line: { shape: 'spline' }
        },
        {
            x: isoDates,
            y: station.Model_bias_eqm,
            mode: 'lines',
            name: 'Empirical Quantile Mapping',
            line: { shape: 'spline' }
        },
        {
            x: isoDates,
            y: station.Model_bias_geoglows,
            mode: 'lines',
            name: 'Geoglows',
            line: { shape: 'spline' }
        }
    ];

    // Build the Plotly chart
    buildChart('biasCorrectionChart', data);
}

function buildChart(chartId, data) {
    const layout = {
        showlegend: true,
        legend: {
            orientation: "h",
            y: 1.1, // puts the legend above the chart
            yanchor: "bottom",
            x: 0.5,
            xanchor: "center"
        },
        xaxis: {
            autorange: true, // allows for zooming
            // type: 'date', 
            // tickformat: 'DD MMM YYYY' // sets the display format for the ticks
        },
        yaxis: {
            autorange: true, // allows for zooming on the y-axis
            fixedrange: false
        },
        margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 100,
        },
        autosize: true
    };

    Plotly.newPlot(chartId, data, layout, { responsive: true });
}


function getChartLimits(datasets) {
    let yMax = 0
    let yMin = 0

    datasets.forEach((dataset) => dataset.data.forEach((item) => {
        if (item > yMax) {
            yMax = item
        } else if (item < yMin) {
            yMin = item
        }
    }))

    return { min: yMin, max: yMax + 100 }
}