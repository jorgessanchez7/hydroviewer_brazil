const FEATURE_Z_INDEX = 100;
const STATIONS = 'stations';
const WARNINGS = 'warnings';
const STREAMS = 'streams';
const ACCUMULATED_RAINFALL = 'accumulated_rainfall';
const RAINFALL_PROBABILITY_50 = 'rainfall_probability_50';
const RAINFALL_PROBABILITY_150 = 'rainfall_probability_150';
const RAINFALL_PROBABILITY_300 = 'rainfall_probability_300';
const OBSERVED_LAYERS_FORECAST = "observed-layers-forecast";
const OBSERVED_LAYERS_OTHERS = "observed-layers-others";

// Main entry point for the WMS.
function buildOverlays() {
    $("#warning .modal-dialog").draggable();
    $("#hydrology .modal-dialog").draggable();
    $("#layers-panel").draggable();
    $("#graph .modal-content").resizable();
    $("#graph .modal-dialog").draggable({ handle: ".modal-header" });
    $("#obsgraph .modal-content").resizable();
    $("#obsgraph .modal-dialog").draggable({ handle: ".modal-header" });
    $("#region .modal-dialog").draggable();
    $("#region2 .modal-dialog").draggable();
    $("#region3 .modal-dialog").draggable();

    buildForecast();
    buildHydrology();
    buildRegions();
    buildRegions2();
    buildRegions3();
}

function buildForecast() {
    const points = {
        [STREAMS]: {
            icon: '<svg width="24" height="24" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polyline points="19 1, 1 6, 19 14, 1 19" stroke="#0000FF" fill="transparent" stroke-width="2"/></svg>',
            name: "Streams warning points",
            layer: wmsStreamsGroupLayer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
        [STATIONS]: {
            // TODO: this probably needs changing
            icon: '<svg width="24" height="24" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polyline points="0 10, 0 0, 10 0, 10 10, 0 10" stroke="rgba(255,0,0,1)" fill="rgba(255,0,0,1)" stroke-width="2"/></svg>',
            name: "Stations warning points",
            layer: wmsStationsGroupLayer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
        [WARNINGS]: {
            name: "Warning points",
            layers: [
                hundredYearWarningLayer,
                fiftyYearWarningLayer,
                twentyFiveYearWarningLayer,
                tenYearWarningLayer,
                fiveYearWarningLayer,
                twoYearWarningLayer,
            ],
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: true,
        },
        [ACCUMULATED_RAINFALL]: {
            name: "Accumulated Rainfall",
            layer: wmsAccumulatedRainfallLayer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
        [RAINFALL_PROBABILITY_50]: {
            name: "Rainfall Probability > 50mm",
            layer: wmsRainfallProbability50Layer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
        [RAINFALL_PROBABILITY_150]: {
            name: "Rainfall Probability > 150mm",
            layer: wmsRainfallProbability150Layer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
        [RAINFALL_PROBABILITY_300]: {
            name: "Rainfall Probability > 300mm",
            layer: wmsRainfallProbability300Layer,
            layerId: OBSERVED_LAYERS_FORECAST,
            isOn: false,
        },
    };

    const parent = $("#warning .modal-body");

    function showAll(show) {
        points[WARNINGS].layers.forEach((layer) => setIsLayerVisible(layer, show));
    }

    function isAllEnabled() {
        return $(`#observed-layer-${WARNINGS}`).find("input").prop("checked");
    }

    Object.keys(points).forEach((key) => {
        if (!map.getPane(key)) map.createPane(key);

        const point = points[key];
        const option = document.createElement("div");
        const title = document.createElement("div");
        const toggle = createToggle({
            isOn: point.isOn,
        });

        option.classList.add("common-option-wrapper");
        title.classList.add("common-option-label");
        title.innerHTML = (point.icon || "") + point.name;

        function observe(isOn) {
            observeLayer({
                key,
                isOn,
                layer: point.layer,
                layerId: point.layerId,
                name: point.name,
                group: rainfallWarningsLayerGroup,
                onToggle: async (isActive) => {
                    switch (key) {
                        case STREAMS:
                            toggleStreamsLayerVisibility(isActive);
                            break;

                        case STATIONS:
                            toggleStationsLayerVisibility(isActive);
                            break;

                        case WARNINGS:
                            showAll(isActive);
                            break;

                        case ACCUMULATED_RAINFALL:
                        case RAINFALL_PROBABILITY_50:
                        case RAINFALL_PROBABILITY_150:
                        case RAINFALL_PROBABILITY_300:
                            toggleRainfallWarningLayerVisibility(key, isActive);
                            break;

                        default:
                            break;
                    }

                    updateHydrologyLayerStyle();
                },
                onRemove: () => {
                    switch (key) {
                        case STREAMS:
                            toggleStreamsLayerVisibility(false);
                            break;

                        case STATIONS:
                            toggleStationsLayerVisibility(false);
                            break;

                        case WARNINGS:
                            showAll(false);
                            break;

                        case ACCUMULATED_RAINFALL:
                        case RAINFALL_PROBABILITY_50:
                        case RAINFALL_PROBABILITY_150:
                        case RAINFALL_PROBABILITY_300:
                            toggleRainfallWarningLayerVisibility(key, false);
                            break;

                        default:
                            break;
                    }

                    $(toggle).find("input").prop("checked", false);

                    updateHydrologyLayerStyle();
                },
            });
        }

        $(option).append(title, toggle);

        if (key === STREAMS || key === STATIONS) {
            const loadingIndicator = document.createElement("i");
            loadingIndicator.classList.add("fa", "fa-spinner", "fa-spin", "loading");
            $(option).append(loadingIndicator);
        }

        $(parent).append(option);
        $(toggle).click(() => {
            const isActive = $(toggle).find("input").prop("checked");

            if (key === WARNINGS) {
                if (isActive) {
                    observe(false)
                } else {
                    stopObservingLayerByKey(key);
                    showAll(false);
                }
            } else {
                if (isActive) {
                    observe(false);
                } else {
                    if (!isAllEnabled()) {
                        setIsLayerVisible(point.layer, false);
                    }

                    if (key === STATIONS) {
                        toggleStationsLayerVisibility(false);
                    } else if (key === STREAMS) {
                        toggleStreamsLayerVisibility(false);
                    }

                    stopObservingLayer(point.layer);
                }
            }

            updateHydrologyLayerStyle();
        });

        point.isOn && observe(true);
    });
}

function buildHydrology() {
    if (typeof ottobacias_index === "undefined") {
        setTimeout(buildHydrology, 50);
        return;
    }

    const items = {};

    Object.keys(ottobacias_index).forEach((key) => {
        items[`ottobacia-${key}`] = {
            ...ottobacias_index[key],
            isOn: key === "brazil",
            group: ottobaciasLayerGroup,
            groupName: OTTOBACIAS_LAYER_GROUP,
        };
    });

    const parent = $("#hydrology .modal-body");

    Object.keys(items).forEach(async (key) => {
        if (!map.getPane(key)) map.createPane(key);

        const item = items[key];
        const option = document.createElement("div");
        const title = document.createElement("div");
        const toggle = createToggle({
            isOn: item.isOn,
        });
        toggle.classList.add("hydrology-option-toggle");

        option.classList.add("common-option-wrapper");
        title.classList.add("common-option-label");
        title.textContent = item.name;

        async function observe(isOn) {
            let layer = item.layer;

            if (!layer) {
                const geojsons = item.geojsons;
                layer = await createGeoJSONLayer({
                    key,
                    geojsons,
                    staticGeoJson: staticGeoJSON,
                    group: item.group,
                    visible: item.isOn,
                    getStyleFunction: getFeatureStyle,
                });

                // Caching
                items[key].layer = layer;
            }

            observeLayer({
                key,
                isOn,
                layer: item.layer,
                name: item.name,
                group: item.group,
                groupName: item.groupName,
                onToggle: (isActive) => {
                    if (isActive && item.group) {
                        hideLayerGroup(item.group);
                    }

                    setIsLayerVisible(item.layer, isActive);

                    updateHydrologyLayerStyle();
                },
                onRemove: () => {
                    setIsLayerVisible(item.layer, false);

                    $(toggle).find("input").prop("checked", false);

                    updateHydrologyLayerStyle();
                },
            });
        }

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(async () => {
            const isActive = $(toggle).find("input").prop("checked");

            if (isActive) {
                await observe(false);
            } else {
                if (!item.layer) {
                    return;
                }

                stopObservingLayer(item.layer);
                setIsLayerVisible(item.layer, false);
            }

            updateHydrologyLayerStyle();
        });

        item.isOn && (await observe(true));
    });
}

function buildRegions() {
    if (typeof region_index === "undefined") {
        setTimeout(buildRegions, 50);
        return;
    }

    const parent = $("#region .modal-body");

    Object.keys(region_index).forEach(async (key) => {
        if (!map.getPane(key)) map.createPane(key);

        const index = region_index[key];
        const option = document.createElement("div");
        const title = document.createElement("div");
        const toggle = document.createElement("div");
        toggle.classList.add("region-toggle");
        toggle.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352c79.5 0 144-64.5 144-144s-64.5-144-144-144S64 128.5 64 208s64.5 144 144 144z"/></svg>';

        option.classList.add("region-option-wrapper");
        title.classList.add("region-option-label");
        title.textContent = index.name;

        async function observe(isOn) {
            let layer = index.layer;

            if (!layer) {
                const geojsons = index.geojsons;
                layer = await createGeoJSONLayer({
                    key,
                    geojsons,
                    staticGeoJson: staticGeoJSON,
                    group: regionsLayerGroup,
                    getStyleFunction: regionsStyle,
                });

                // Caching
                region_index[key].layer = layer;
            }

            observeLayer({
                key,
                isOn,
                layer,
                name: index.name,
                group: regionsLayerGroup,
                groupName: REGIONS_LAYER_GROUP,
                onToggle: (isActive) => {
                    if (isActive) {
                        hideLayerGroup(regionsLayerGroup);
                    }

                    setIsLayerVisible(layer, isActive);
                    zoomToLayer(layer);
                },
                onRemove: () => {
                    $(toggle).find("input").prop("checked", false);
                    setIsLayerVisible(index.layer, false);
                },
            });

            setIsLayerVisible(layer, true);
            setTimeout(() => zoomToLayer(layer), 500);
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(async () => {
            disableObservedLayerGroup(REGIONS_LAYER_GROUP, getLayerId(key));
            hideLayerGroup(regionsLayerGroup);
            await observe(true);
        });
        if (index.name == "Brazil") {
            await observe(true);
        }
    });
}

function buildRegions2() {
    if (typeof region_index2 === "undefined") {
        setTimeout(buildRegions2, 50);
        return;
    }

    const parent = $("#region2 .modal-body");

    Object.keys(region_index2).forEach((key) => {
        if (!map.getPane(key)) map.createPane(key);

        const index = region_index2[key];
        const option = document.createElement("div");
        const title = document.createElement("div");
        const toggle = document.createElement("div");
        toggle.classList.add("region2-toggle");
        toggle.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352c79.5 0 144-64.5 144-144s-64.5-144-144-144S64 128.5 64 208s64.5 144 144 144z"/></svg>';

        option.classList.add("region2-option-wrapper");
        title.classList.add("region2-option-label");
        title.textContent = index.name;

        async function observe(isOn) {
            let layer = index.layer;

            if (!layer) {
                const geojsons = index.geojsons;
                layer = await createGeoJSONLayer({
                    key,
                    geojsons,
                    staticGeoJson: staticGeoJSON2,
                    group: regionsLayerGroup,
                    getStyleFunction: regionsStyle,
                });

                // Caching
                region_index2[key].layer = layer;
            }

            observeLayer({
                key,
                isOn,
                layer,
                name: index.name,
                group: regionsLayerGroup,
                groupName: REGIONS_LAYER_GROUP,
                onToggle: (isActive) => {
                    if (isActive) {
                        hideLayerGroup(regionsLayerGroup);
                    }

                    setIsLayerVisible(layer, isActive);
                    zoomToLayer(layer);
                },
                onRemove: () => {
                    $(toggle).find("input").prop("checked", false);
                    setIsLayerVisible(index.layer, false);
                },
            });

            setIsLayerVisible(layer, true);
            setTimeout(() => zoomToLayer(layer), 500);
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(async () => {
            disableObservedLayerGroup(REGIONS_LAYER_GROUP, getLayerId(key));
            hideLayerGroup(regionsLayerGroup);
            await observe(true);
        });
    });
}

function buildRegions3() {
    if (typeof region_index3 === "undefined") {
        setTimeout(buildRegions3, 50);
        return;
    }

    const parent = $("#region3 .modal-body");

    Object.keys(region_index3).forEach((key) => {
        if (!map.getPane(key)) map.createPane(key);

        const index = region_index3[key];
        const option = document.createElement("div");
        const title = document.createElement("div");
        const toggle = document.createElement("div");
        toggle.classList.add("region3-toggle");
        toggle.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352c79.5 0 144-64.5 144-144s-64.5-144-144-144S64 128.5 64 208s64.5 144 144 144z"/></svg>';

        option.classList.add("region3-option-wrapper");
        title.classList.add("region3-option-label");
        title.textContent = index.name;

        async function observe(isOn) {
            let layer = index.layer;

            if (!layer) {
                const geojsons = index.geojsons;
                layer = await createGeoJSONLayer({
                    key,
                    staticGeoJson: staticGeoJSON3,
                    geojsons,
                    group: regionsLayerGroup,
                    getStyleFunction: regionsStyle,
                });

                // Caching
                region_index3[key].layer = layer;
            }

            observeLayer({
                key,
                isOn,
                layer,
                name: index.name,
                group: regionsLayerGroup,
                groupName: REGIONS_LAYER_GROUP,
                onToggle: (isActive) => {
                    if (isActive) {
                        hideLayerGroup(regionsLayerGroup);
                    }

                    setIsLayerVisible(layer, isActive);
                    zoomToLayer(layer);
                },
                onRemove: () => {
                    $(toggle).find("input").prop("checked", false);
                    setIsLayerVisible(index.layer, false);
                },
            });

            setIsLayerVisible(layer, true);
            setTimeout(() => zoomToLayer(layer), 500);
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(async () => {
            disableObservedLayerGroup(REGIONS_LAYER_GROUP, getLayerId(key));
            hideLayerGroup(regionsLayerGroup);
            await observe(true);
        });
    });
}

const isToggleEnabled = (parent, id) => {
    return $(parent).find(id).hasClass("active");
};

function createToggle(options = {}) {
    const { isOn, size, hideLabels } = options;

    const wrapper = document.createElement("span");
    wrapper.classList.add("toggle-switchy");
    wrapper.setAttribute("data-style", "rounded");
    wrapper.setAttribute("data-size", size || "sm");
    wrapper.setAttribute("data-text", hideLabels ? "false" : "true");

    const input = document.createElement("input");
    input.type = "checkbox";

    if (isOn) {
        $(input).prop("checked", true);
    }

    const toggle = document.createElement("span");
    toggle.classList.add("toggle");

    const switchEl = document.createElement("span");
    switchEl.classList.add("switch");

    toggle.append(switchEl);
    wrapper.append(input);
    wrapper.append(toggle);

    $(wrapper).click(() => {
        $(input).prop("checked", !$(input).prop("checked"));
    });

    return wrapper;
}

function disableObservedLayerGroup(groupName, except) {
    if (!groupName) {
        return;
    }

    $(`#layers-panel #${OBSERVED_LAYERS_OTHERS}`).find(`[data-group='${groupName}']`).each((_, el) => {
        if (except && el === except) { return; }

        $(el).find('input').prop('checked', false);

        const id = el.id.replace('observed-layer-others', '');

        observedLayers.forEach((item, index) => {
            if (getLayerId(item.key) === id) {
                observedLayers[index] = { ...observedLayers[index], isOn: false }
                return;
            }
        });
    });
}

function updateLayersZIndex() {
    const totalLayers = observedLayers.length;

    let index = 0;

    const forecastLayers = observedLayers.filter((item) => item.layerId === OBSERVED_LAYERS_FORECAST)
    const otherLayers = observedLayers.filter((item) => item.layerId !== OBSERVED_LAYERS_FORECAST)

    for (let observed of forecastLayers) {
        if (observed.layers) {
            index += observed.layers.length;
        } else {
            index++;
        }

        moveLayer(observed.key, totalLayers - index);
    }

    for (let observed of otherLayers) {
        if (observed.layers) {
            index += observed.layers.length;
        } else {
            index++;
        }

        moveLayer(observed.key, totalLayers - index);
    }
}

function moveLayer(pane, toIndex) {
    map.getPane(pane).style.zIndex = 400 + toIndex
}

function buildObservedLayers() {
    const containerForecast = $(`#${OBSERVED_LAYERS_FORECAST}`);
    const containerOthers = $(`#${OBSERVED_LAYERS_OTHERS}`);

    $(containerForecast).empty();
    $(containerOthers).empty();

    observedLayers.forEach((observedLayer) => {
        const child = buildObservedLayer(observedLayer);

        if (observedLayer.layerId === OBSERVED_LAYERS_FORECAST) {
            containerForecast.append(child);
        } else {
            containerOthers.append(child);
        }
    });

    updateLayersZIndex();
}

function buildObservedLayer(observedLayer) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("observed-layer-wrapper");
    wrapper.id = getLayerId(observedLayer.key);
    wrapper.setAttribute("data-group", observedLayer.groupName || "");

    const title = document.createElement("div");
    title.classList.add("observed-layer-title");
    title.textContent = observedLayer.name;

    const controls = document.createElement("div");
    controls.classList.add("observed-layer-controls");

    const toggle = createToggle({
        isOn: observedLayer.isOn,
        size: "xs",
        hideLabels: true,
    });

    const remove = document.createElement("div");
    remove.classList.add("observed-layer-control");
    remove.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/></svg>';

    const moveUp = document.createElement("div");
    moveUp.classList.add("observed-layer-control", "move-up");
    moveUp.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/></svg>';

    const moveDown = document.createElement("div");
    moveDown.classList.add("observed-layer-control", "move-down");
    moveDown.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>';

    const info = document.createElement("div");
    info.classList.add("observed-layer-control", "info");
    info.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512"><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M48 80a48 48 0 1 1 96 0A48 48 0 1 1 48 80zM0 224c0-17.7 14.3-32 32-32H96c17.7 0 32 14.3 32 32V448h32c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H64V256H32c-17.7 0-32-14.3-32-32z"/></svg>';

    controls.append(moveUp);
    controls.append(moveDown);
    controls.append(toggle);
    controls.append(remove);
    controls.append(info);
    wrapper.append(title);
    wrapper.append(controls);

    function moveLayer(diff) {
        const forecastLayers = observedLayers.filter((item) => item.layerId === OBSERVED_LAYERS_FORECAST)
        const otherLayers = observedLayers.filter((item) => item.layerId !== OBSERVED_LAYERS_FORECAST)

        if (observedLayer.layerId === OBSERVED_LAYERS_FORECAST) {
            resolveMoveLayer(forecastLayers, diff)
        } else {
            resolveMoveLayer(otherLayers, diff)
        }

        observedLayers = [...forecastLayers, ...otherLayers]

        buildObservedLayers();
    }

    function resolveMoveLayer(layers, diff) {
        const currentIndex = layers.findIndex((ol) => ol === observedLayer);
        const removed = layers.splice(currentIndex, 1);

        layers.splice(currentIndex + diff, 0, ...removed);
    }

    $(moveUp).click(() => {
        $(wrapper).prev().insertAfter(wrapper);
        moveLayer(-1);
    });

    $(moveDown).click(() => {
        $(wrapper).next().insertBefore(wrapper);
        moveLayer(1);
    });

    $(info).click(() => {
        var modalName = title.textContent.split(" ")[0];
        var modals = ["Streams", "Stations", "Warning", "Ottobacia"];
        if (modals.includes(modalName)) {
            $("#about-" + modalName).modal("show");
        } else if (modalName == "Accumulated" || modalName == "Rainfall") {
            $("#about-Rainfall").modal("show");
        } else {
            $("#about-Zoom").modal("show");
        }
    });

    $(toggle).click(() => {
        disableObservedLayerGroup(observedLayer.groupName, wrapper);

        const isChecked = $(toggle).find("input").prop("checked");

        const index = observedLayers.findIndex((item) => item.key === observedLayer.key)

        observedLayer.isOn = isChecked

        observedLayers[index] = observedLayer

        if (observedLayer.onToggle) {
            observedLayer.onToggle(isChecked);
        }
    });

    $(remove).click(() => {
        if (observedLayer.layer) {
            stopObservingLayer(observedLayer.layer);
        } else if (observedLayer.key) {
            stopObservingLayerByKey(observedLayer.key);
        }

        if (observedLayer.onRemove) {
            observedLayer.onRemove();
        }

        buildObservedLayers();
    });

    return wrapper;
}

function checkEmptyObservedLayers() {
    const haveForecastItems = observedLayers.filter((item) => item.layerId === OBSERVED_LAYERS_FORECAST).length > 0

    if (haveForecastItems) {
        $(`#${OBSERVED_LAYERS_FORECAST}`).removeClass("invisible");
    } else {
        $(`#${OBSERVED_LAYERS_FORECAST}`).addClass("invisible");
    }

    if (observedLayers.length === 0) {
        $("#layers-panel-empty").removeClass("invisible");
    } else {
        $("#layers-panel-empty").addClass("invisible");
    }
}

function removeObservedLayer(observed) {
    const element = $(`#${OBSERVED_LAYERS_OTHERS} #${OBSERVED_LAYERS_OTHERS}-${observed.key}`);
    element.remove();

    checkEmptyObservedLayers();
}

function observeLayer(options) {
    const layerData = {
        key: options.key,
        layer: options.layer,
        layerId: options.layerId ?? OBSERVED_LAYERS_OTHERS,
        layers: options.layers,
        name: options.name,
        group: options.group,
        groupName: options.groupName,
        onToggle: options.onToggle,
        onRemove: options.onRemove,
        isOn: options.isOn,
    };

    const index = layerData.key
        ? observedLayers.findIndex((l) => l.key === layerData.key)
        : -1;

    if (index >= 0) {
        observedLayers[index] = layerData;
    } else {
        observedLayers.push(layerData);
    }

    checkEmptyObservedLayers();
    buildObservedLayers();
}

function getLayerId(layerKey) {
    return `observed-layer-${layerKey}`
}

function stopObservingLayer(layer) {
    if (!layer) return

    const index = observedLayers.findIndex((l) => l.layer === layer);
    const [observedLayer] = observedLayers.splice(index, 1);

    removeObservedLayer(observedLayer);
};

function stopObservingLayerByKey(key) {
    const index = observedLayers.findIndex((l) => l.key === key);
    const [observedLayer] = observedLayers.splice(index, 1);

    removeObservedLayer(observedLayer);
};

$("#ottobacias-button").click(function () {
    $("#ottobacias-content").toggleClass("active");

    if ($("#ottobacias-content").hasClass("active")) {
        $("#ottobacias-content").css(
            "maxHeight",
            $("#ottobacias-content").prop("scrollHeight")
        );
    } else {
        $("#ottobacias-content").css("maxHeight", 0);
    }
});

function buildWarningPointsLayer(points, layer, period) {
    layer.clearLayers()

    for (let i = 0; i < points.length; ++i) {
        const flow = points[i][4]
        const coord = [points[i][1], points[i][2]]
        const comid = points[i][3]
        const feature = L.shapeMarker(coord,
            {
                shape: flow === "same" ? "circle" : `triangle-${flow}`,
                pane: WARNINGS,
                id: comid,
            }).on('click', (event) => {
                 buildWarningModal(event);
            });

        layer.addLayer(feature)

        applyWarningPointStyle(feature, period, points[i])
    }
}

function buildStreamsLayer() {
    let zIndex

    const streamsPane = map.getPane(STREAMS)
    if (!streamsPane) {
        map.createPane(STREAMS)
    } else {
        zIndex = streamsPane.style.zIndex
    }

    const streamStyle = {
        color: '#3388ff', 
        weight: 2,        
        opacity: 0.7     
    };

    wmsStreamsLayer = L.geoJSON(streamsData, {
        pane: STREAMS,
        zIndex: zIndex,
        style: streamStyle,
    }).addTo(map).on('click', (event) => {
        buildForecastModal(event)
    });

    map.addLayer(wmsStreamsLayer);
}

function buildStationsLayer() {
    if (typeof stationsData === "undefined" || stationsData.length === 0) {
        setTimeout(buildStationsLayer, 50);
        return;
    }

    let zIndex

    const stationsPane = map.getPane(STATIONS)
    if (!stationsPane) {
        map.createPane(STATIONS)
    } else {
        zIndex = stationsPane.style.zIndex
    }

    wmsStationsLayer = L.geoJSON(null, {
        pane: STATIONS,
    }).addTo(map)

    map.addLayer(wmsStationsLayer);



    stationsData.forEach((station) => {
        const coord = [station.lat, station.lon]

        const feature = L.marker(coord, {
            icon: buildStationIcon({}),
            pane: STATIONS,
            zIndex: zIndex,
            id: station.id
        }).on('click', (e) => {
            getStationData(e.target.options.id)
        });

        wmsStationsLayer.addLayer(feature)
    })
}

function buildStationIcon({ width = 15, height = 20, fillColor = '#ff5c62', borderColor = '#000' }) {
    const stationPinSVG = `<svg 
        width="${width}"
        height="${height}" 
        viewBox="0 0 26.458 39.688" 
        xml:space="preserve" 
        xmlns="http://www.w3.org/2000/svg">
            <path 
                style="
                    opacity:1;
                    fill:${fillColor};
                    fill-opacity:1;
                    stroke: ${borderColor};
                    stroke-width: 1;
                    stroke-linecap: round
                " 
                d="M13.196 1.453c-6.392 0-11.574 5.182-11.574 11.575 0 6.392 8.785 18.78 11.84 24.659 3.32-6.426 11.12-17.644 11.369-25.132.212-6.389-5.242-11.102-11.635-11.102Zm.173 6.75a4.434 4.434 0 1 1-.001 8.867 4.434 4.434 0 0 1 .001-8.868z"/>
        </svg>`

    const svgIcon = L.divIcon({
        html: stationPinSVG,
        className: "",
        // Sets the SVG total size
        iconSize: [width, height],
        // Sets the position that should be considered the "tip"
        // of the SVG, relative to its top left corner.
        iconAnchor: [7.5, 20],
    })

    return svgIcon
}

function buildRainfallWarning(name) {
    let zIndex

    const pane = map.getPane(name)
    if (!pane) {
        map.createPane(name)
    } else {
        zIndex = pane.style.zIndex
    }

    switch (name) {
        case ACCUMULATED_RAINFALL:
            wmsAccumulatedRainfallLayer = L.tileLayer.wms(`${glofasURL}?&layers={layers}&tiled={tiled}&serverType={serverType}`,
                {
                    layers: 'AccRainEGE',
                    tiled: true,
                    serverType: 'mapserver',
                    transparent: true,
                    format: 'image/png',
                    pane: ACCUMULATED_RAINFALL,
                    zIndex: zIndex
                }).addTo(map);
            break;

        case RAINFALL_PROBABILITY_50:
            wmsRainfallProbability50Layer = L.tileLayer.wms(`${glofasURL}?&layers={layers}&tiled={tiled}&serverType={serverType}`,
                {
                    layers: 'EGE_probRgt50',
                    tiled: true,
                    serverType: 'mapserver',
                    transparent: true,
                    format: 'image/png',
                    pane: RAINFALL_PROBABILITY_50,
                    zIndex: zIndex
                }).addTo(map);
            break;

        case RAINFALL_PROBABILITY_150:
            wmsRainfallProbability150Layer = L.tileLayer.wms(`${glofasURL}?&layers={layers}&tiled={tiled}&serverType={serverType}`,
                {
                    layers: 'EGE_probRgt150',
                    tiled: true,
                    serverType: 'mapserver',
                    transparent: true,
                    format: 'image/png',
                    pane: RAINFALL_PROBABILITY_150,
                    zIndex: zIndex
                }).addTo(map);
            break;

        case RAINFALL_PROBABILITY_300:
            wmsRainfallProbability300Layer = L.tileLayer.wms(`${glofasURL}?&layers={layers}&tiled={tiled}&serverType={serverType}`,
                {
                    layers: 'EGE_probRgt300',
                    tiled: true,
                    serverType: 'mapserver',
                    transparent: true,
                    format: 'image/png',
                    pane: RAINFALL_PROBABILITY_300,
                    zIndex: zIndex
                }).addTo(map);
            break;
    }
}

function toggleStreamsLayerVisibility(isVisible) {
    if (isVisible && !wmsStreamsLayer) {
        buildStreamsLayer()
    } else {
        if (wmsStreamsLayer) {
            map.removeLayer(wmsStreamsLayer);
            wmsStreamsLayer = null;
        }
    }
}

function toggleStationsLayerVisibility(isVisible) {
    if (isVisible && !wmsStationsLayer) {
        buildStationsLayer()
    } else {
        if (wmsStationsLayer) {
            map.removeLayer(wmsStationsLayer);
            wmsStationsLayer = null;
        }
    }
}

function toggleRainfallWarningLayerVisibility(name, isVisible) {
    let layer

    switch (name) {
        case ACCUMULATED_RAINFALL:
            layer = wmsAccumulatedRainfallLayer;
            break;

        case RAINFALL_PROBABILITY_50:
            layer = wmsRainfallProbability50Layer;
            break;

        case RAINFALL_PROBABILITY_150:
            layer = wmsRainfallProbability150Layer;
            break;

        case RAINFALL_PROBABILITY_300:
            layer = wmsRainfallProbability300Layer;
            break;
    }

    if (isVisible && !layer) {
        buildRainfallWarning(name)
    } else {
        if (layer) {
            map.removeLayer(layer);
        }

        switch (name) {
            case ACCUMULATED_RAINFALL:
                wmsAccumulatedRainfallLayer = null;
                break;

            case RAINFALL_PROBABILITY_50:
                wmsRainfallProbability50Layer = null;
                break;

            case RAINFALL_PROBABILITY_150:
                wmsRainfallProbability150Layer = null;
                break;

            case RAINFALL_PROBABILITY_300:
                wmsRainfallProbability300Layer = null;
                break;
        }
    }
}

function updateHydrologyLayerStyle() {
    const hydrologyLayers = observedLayers.filter((item) => item.key.includes("ottobacia") && item.isOn)

    if (hydrologyLayers.length === 0) {
        return
    }

    const hydrologyLayer = hydrologyLayers[0].layer

    const warningLayers = observedLayers.filter((item) => item.key === WARNINGS);

    if (warningLayers.length === 0 || !warningLayers[0].isOn) {
        hydrologyLayer.eachLayer(function (feature) {
            feature.setStyle({
                fillColor: 'transparent',
                fillOpacity: 1,
            })
        });

        return
    }

    const layers = [
        [twoYearWarningLayer, TWO_YEAR_WARNING_COLOR],
        [fiveYearWarningLayer, FIVE_YEAR_WARNING_COLOR],
        [tenYearWarningLayer, TEN_YEAR_WARNING_COLOR],
        [twentyFiveYearWarningLayer, TWENTY_FIVE_YEAR_WARNING_COLOR],
        [fiftyYearWarningLayer, FIFTY_YEAR_WARNING_COLOR],
        [hundredYearWarningLayer, HUNDRED_YEAR_WARNING_COLOR],
    ];

    hydrologyLayer.eachLayer(function (feature) {
        const polygonData = []

        feature.getLatLngs().forEach((item) => {
            item.forEach((child) => {
                if (child.lat) {
                    polygonData.push([child.lat, child.lng])
                } else {
                    child.forEach((otherChild) => {
                        polygonData.push([otherChild.lat, otherChild.lng])
                    })
                }
            })
        })

        polygonData.push(polygonData[0])

        const polygon = turf.polygon([polygonData]);

        for (let [warningLayer, color] of layers) {
            warningLayer.eachLayer((warningFeatureLayer) => {
                const center = warningFeatureLayer.getLatLng();

                var point = turf.point([center.lat, center.lng]);

                const isPointInPolygon = turf.booleanPointInPolygon(point, polygon);

                if (isPointInPolygon) {
                    feature.setStyle({
                        fillColor: color,
                        fillOpacity: 1,
                    })
                }
            })
        }
    });
}

function buildStationModal(json) {
    const latLng = L.latLng(json.station.Lat, json.station.Lon)

    const popupContent = `<div class="station-popup">
        <p><b>Name</b>: ${json.station.Name}</p>
        <p><b>Comid</b>: ${json.station._id}</p>
        <p><b>Latitude</b>: ${json.station.Lat}</p>
        <p><b>Longitude</b>: ${json.station.Lon}</p>
        <br />
        <button id="station-popup-view-data">Visualize the data</button>
    </div>`

    const popup = L.popup();
    popup
        .setLatLng(latLng)
        .setContent(popupContent)
        .openOn(map);


    function handleStationViewData(station) {
        popup.close()

        $("#obsgraph").modal('show');

        $("#station-info").empty();

        $("#station-info").append(`<h5>Current Station: ${station.Name}</h5>`);
        $("#station-info").append(`<p><b>Latitude</b>: ${json.station.Lat}</p>`);
        $("#station-info").append(`<p><b>Longitude</b>: ${json.station.Lon}</p>`);
        $("#station-info").append(`<p><b>Comid</b>: ${json.station._id}</p>`);

        buildStationChart(station)
    }

    document.getElementById("station-popup-view-data").onclick = () => handleStationViewData(json.station);
}

function constructWMSGetFeatureInfoUrl(latlng, map) {
    const url = new URL(JSON.parse($('#geoserver_endpoint').val())[0].replace(/\/$/, "") + 'wms');
    const layerName = watershedLayerName()
    var crs = map.options.crs;
    var size = map.getSize();
    var bounds = map.getBounds();
    var nw = crs.project(bounds.getNorthWest());
    var se = crs.project(bounds.getSouthEast());
    var pixelPoint = map.latLngToContainerPoint(latlng);
    // The parameters for the WMS GetFeatureInfo request
    url.searchParams.append('SERVICE', 'WMS');
    url.searchParams.append('VERSION', '1.3.0');
    url.searchParams.append('REQUEST', 'GetFeatureInfo');
    url.searchParams.append('FORMAT', 'image/png');
    url.searchParams.append('TRANSPARENT', 'true');
    url.searchParams.append('QUERY_LAYERS',  watershedLayerName());
    url.searchParams.append('LAYERS',  watershedLayerName());
    url.searchParams.append('INFO_FORMAT', 'application/json');
    url.searchParams.append('I', Math.round(pixelPoint.x));
    url.searchParams.append('J', Math.round(pixelPoint.y));
    url.searchParams.append('CRS', crs.code);
    url.searchParams.append('WIDTH', size.x);
    url.searchParams.append('HEIGHT', size.y);
    url.searchParams.append('BBOX', [nw.x, se.y, se.x, nw.y].join(','));

    return url.href;
}

function buildForecastModal(event) {
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
    $('#dates').addClass('hidden');
    loadingComponent.removeClass('hidden');


    let wms_url;

    url = constructWMSGetFeatureInfoUrl(event.latlng, map);

    wms_url = url;

    console.log("<debug> wms_url: ", wms_url);

    const onSuccess = (model, watershed, subbasin, comid) => {
        const startdate = '';

        if (model === 'ECMWF-RAPID') {
            getForecastPercent(watershed, subbasin, comid, startdate);
        };

        getAvailableDates(model, watershed, subbasin, comid);
        getRequestData(model, watershed, subbasin, comid, startdate);

        var workspace = JSON.parse($('#geoserver_endpoint').val())[1];

        $('#info').addClass('hidden');

        addFeature(model, workspace, comid);
    };

    const geoserverEndpoint = JSON.parse($('#geoserver_endpoint').val())[2];
    const model = $('#model option:selected').text();

    $.ajax({
        type: "GET",
        url: wms_url,
        dataType: 'json',
        success: function (result) {
            if (!result.features || result.features.length === 0 || !result.features[0]) {
                $("#graph").modal('hide');
                $("#zoomErrorModal").modal('show');
                return;
            }

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
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log(XMLHttpRequest);
            console.log(textStatus);
            console.log(errorThrown);
        }
    });
$("#zoomErrorModal").on('hidden.bs.modal', function () {
    $("#graph").modal('hide');
});

}

function buildWarningModal(event) {
    var model = $('#model option:selected').text();

    $("#graph").modal('show');
    $("#tbody").empty();
    $('#long-term-chart').addClass('hidden');
    $("#forecast-table").addClass('hidden');
    $('#historical-chart').addClass('hidden');
    $('#fdc-chart').addClass('hidden');
    $('#seasonal_d-chart').addClass('hidden');
    $('#seasonal_m-chart').addClass('hidden');
    $('#download_forecast').addClass('hidden');
    $('#download_era_5').addClass('hidden');
    $('#dates').addClass('hidden');

    // const model = 'ECMWF-RAPID'
    const watershed = 'south_america';
    const subbasin = 'geoglows';
    const comid = event.target.options.id;
    const startdate = '';

    get_forecast_percent(watershed, subbasin, comid, startdate);
    getAvailableDates(model, watershed, subbasin, comid);
    get_requestData (model, watershed, subbasin, comid, startdate);
    $('#info').addClass('hidden');
    // loadingComponent.addClass('hidden');

}