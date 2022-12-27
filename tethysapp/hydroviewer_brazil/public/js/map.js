const REGIONS_GROUP = 'regions';
const OTTOBACIAS_GROUP = 'ottobacias';
const FEATURE_Z_INDEX = 100;

const moveLayer = (layer, toIndex) => {
    const index = findLayerIndex(layer);
    
    if (index === -1 || index === toIndex) { return; }

    const removed = map.getLayers().removeAt(index);
    map.getLayers().insertAt(toIndex, removed);
}

const moveLayers = (layers, toIndex) => {
    layers.forEach((layer, index) => {
        moveLayer(layer, toIndex - index);
    });
}

const findLayerIndex = (layer) => {
    return map.getLayers().getArray().findIndex((l) => l === layer);
}

const featureStyle = (feature) => {
    const layers = [
        [ hundred_year_warning, HUNDRED_YEAR_WARNING_COLOR ],
        [ fifty_year_warning, FIFTY_YEAR_WARNING_COLOR ],
        [ twenty_five_year_warning, TWENTY_FIVE_YEAR_WARNING_COLOR ],
        [ ten_year_warning, TEN_YEAR_WARNING_COLOR ],
        [ five_year_warning, FIVE_YEAR_WARNING_COLOR ],
        [ two_year_warning, TWO_YEAR_WARNING_COLOR ],
    ];

    for (let [ layer, color ] of layers) {
        if (checkIntersectionsWithLayer(feature, layer)) {
            return new ol.style.Style({
                fill: new ol.style.Fill({color}),
                stroke: new ol.style.Stroke({
                    color,
                    width: 3,
                }),
                zIndex: FEATURE_Z_INDEX,
            });
        }
    }
  
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: DEFAULT_COLOR,
            width: 3,
        }),
        zIndex: 1,
    });
};

const regionsStyle = () => {
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: REGION_COLOR,
            width: 3,
        }),
        zIndex: 1,
    });
};
  
 const checkIntersectionsWithLayer = (feature, withLayer) => {
    if (!withLayer.getVisible()) { return false; }
  
    const featureGeomery = feature.getGeometry();
    const layerSource = withLayer.getSource();
    const layerFeatures = layerSource.getFeatures();
  
    for (let layerFeature of layerFeatures) {
        const coordinates = layerFeature.getGeometry().getCoordinates();
  
        if (featureGeomery.intersectsCoordinate(coordinates)) {
            return true;
        }
    }
  
    return false;
 };
  
 const checkIntersections = () => {
    const layers = map.getLayers().getArray();
  
    for (let layer of layers) {
        if (layer.get('group') === OTTOBACIAS_GROUP) {
            const source = layer.getSource();
            source.refresh();
        }
    }
 }
  
 const isToggleEnabled = (parent, id) => {
    return $(parent).find(id).hasClass('active');
 };
  
 const createToggle = (options = {}) => {
    const {
        isOn,
        size,
        hideLabels,
    } = options;
  
    const wrapper = document.createElement('span');
    wrapper.classList.add('toggle-switchy');
    wrapper.setAttribute('data-style', 'rounded');
    wrapper.setAttribute('data-size', size || 'sm');
    wrapper.setAttribute('data-text', hideLabels ? 'false' : 'true');
  
    const input = document.createElement('input');
    input.type = 'checkbox';
  
    if (isOn) {
        $(input).prop('checked', true);
    }
  
    const toggle = document.createElement('span');
    toggle.classList.add('toggle');
  
    const switchEl = document.createElement('span');
    switchEl.classList.add('switch');
  
    toggle.append(switchEl);
    wrapper.append(input);
    wrapper.append(toggle);
  
    $(wrapper).click(() => {
        $(input).prop('checked', !$(input).prop('checked'));
    });
  
    return wrapper;
 };

 const buildWarningPoints = () => {
    if (typeof wmsLayer === 'undefined') {
        setTimeout(buildWarningPoints, 50);
        return;
    }

    const points = {
        streams: {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polyline points="19 1, 1 6, 19 14, 1 19" stroke="#0000FF" fill="transparent" stroke-width="2"/></svg>',
            name: 'Streams',
            layer: wmsLayer,
            isOn: true,
        },
        'all-warning': {
            name: 'Warning points',
            layers: [
                hundred_year_warning,
                fifty_year_warning,
                twenty_five_year_warning,
                ten_year_warning,
                five_year_warning,
                two_year_warning,
            ],
        },
        accumulatedRainfall: {
            name: 'Accumulated Rainfall',
            layer: wms_layers[0],
        },
        rainfallProbability50: {
            name: 'Rainfall Probability > 50mm',
            layer: wms_layers[1],
        },
        rainfallProbability150: {
            name: 'Rainfall Probability > 150mm',
            layer: wms_layers[2],
        },
        rainfallProbability300: {
            name: 'Rainfall Probability > 300mm',
            layer: wms_layers[3],
        },
    };

    const parent = $('#warning .modal-body');
  
    const showAll = (show) => {
        points['all-warning']
            .layers
            .forEach((layer) => layer.setVisible(show));
    };

    const isAllEnabled = () => {
        return $('#observed-layer-all-warning').find('input').prop('checked');
    }

    const isEnabled = (key) => {
        return $(`#observed-layer-${ key }`).find('input').prop('checked');
    }

    Object.keys(points).forEach((key) => {
        const point = points[key];
        const option = document.createElement('div');
        const title = document.createElement('div');
        const toggle = createToggle({
            isOn: point.isOn,
        });
  
        option.classList.add('common-option-wrapper');
        title.classList.add('common-option-label');
        title.innerHTML = (point.icon || '') + point.name;
  
        const observe = (isOn) => {
            observeLayer({
                key,
                layer: point.layer,
                name: point.name,
                isOn,
                onToggle: async (isActive) => {
                    point.layer.setVisible(isActive);
                    checkIntersections();
                },
                onRemove: () => {
                    point.layer.setVisible(false);
                    checkIntersections();
                    $(toggle).find('input').prop('checked', false);
                },
            });
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(() => {
            const isActive = $(toggle).find('input').prop('checked');

            if (key === 'all-warning') {
                if (isActive) {
                    observeLayer({
                        key,
                        name: point.name,
                        layers: point.layers,
                        onToggle: (isActive) => {
                            showAll(isActive);
                            checkIntersections();
                        },
                        onRemove: () => {
                            showAll(false);
                            checkIntersections();
                            $(toggle).find('input').prop('checked', false);
                        },
                    });
                } else {
                    stopObservingLayerByKey(key);
                    showAll(false);
                    checkIntersections();
                }
            } else {
                if (isActive) {
                    observe(false);
                } else {
                    if (!isAllEnabled() || key === 'streams') {
                        point.layer.setVisible(false);
                        checkIntersections();
                    }
                    stopObservingLayer(point.layer);
                }
            }
        });

        point.isOn && observe(true);
    });
 };

 const buildHydrology = () => {
    if (typeof ottobacias_index === 'undefined') {
        setTimeout(buildHydrology, 50);
        return;
    }

    const items = {
        stations: {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polyline points="0 10, 0 0, 10 0, 10 10, 0 10" stroke="rgba(255,0,0,1)" fill="rgba(255,0,0,1)" stroke-width="2"/></svg>',
            name: 'Stations',
            layer: wmsLayer2,
            isOn: true,
        },
    };

    Object.keys(ottobacias_index).forEach((key) => {
        items[`ottobacia-${ key }`] = {
            ...ottobacias_index[key],
            isOn: key === 'level_1',
            group: OTTOBACIAS_GROUP,
        };
    });

    const parent = $('#hydrology .modal-body');
  
    Object.keys(items).forEach((key) => {
        const item = items[key];
        const option = document.createElement('div');
        const title = document.createElement('div');
        const toggle = createToggle({
            isOn: item.isOn,
        });
        toggle.classList.add('hydrology-option-toggle');
  
        option.classList.add('common-option-wrapper');
        title.classList.add('common-option-label');
        title.textContent = item.name;

        const observe = (isOn) => {
            let layer = item.layer;

            if (!layer) {
                const geojsons = item.geojsons;
                layer = createGeojsonsLayer({
                    geojsons,
                    layerName: key,
                    group: item.group,
                    visible: item.isOn,
                    style: featureStyle,
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
                onToggle: (isActive) => {
                    if (isActive && item.group) {
                        turnOffLayerGroup(map, item.group, item.layer);   
                    }

                    item.layer.setVisible(isActive);
                },
                onRemove: () => {
                    $(toggle).find('input').prop('checked', false);
                    item.layer.setVisible(false);
                },
            });

            isOn && item.layer.setVisible(true);
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(() => {
            const isActive = $(toggle).find('input').prop('checked');

            if (isActive) {
                observe(false);
            } else {
                if (!item.layer) { return; }
                stopObservingLayer(item.layer);
                item.layer.setVisible(false);
            }
        });

        item.isOn && observe(true);
    });
 };
  
 const buildRegions = () => {
    if (typeof region_index === 'undefined') {
        setTimeout(buildRegions, 50);
        return;
    }

    const parent = $('#region .modal-body');
  
    Object.keys(region_index).forEach((key) => {
        const index = region_index[key];
        const option = document.createElement('div');
        const title = document.createElement('div');
        const toggle = document.createElement('div');
        toggle.classList.add('region-toggle')
        toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352c79.5 0 144-64.5 144-144s-64.5-144-144-144S64 128.5 64 208s64.5 144 144 144z"/></svg>';
  
        option.classList.add('region-option-wrapper');
        title.classList.add('region-option-label');
        title.textContent = index.name;
  
        const observe = (isOn) => {
            let layer = index.layer;

            if (!layer) {
                const geojsons = index.geojsons;
                layer = createGeojsonsLayer({
                    geojsons,
                    layerName: key,
                    group: REGIONS_GROUP,
                    style: regionsStyle,
                });

                // Caching
                region_index[key].layer = layer;
            }

            observeLayer({
                key,
                isOn,
                layer,
                name: index.name,
                group: REGIONS_GROUP,
                onToggle: (isActive) => {
                    if (isActive) {
                        turnOffLayerGroup(map, REGIONS_GROUP, layer);
                    }
    
                    layer.setVisible(isActive);
                    zoomToLayer(layer);
                },
                onRemove: () => {
                    $(toggle).find('input').prop('checked', false);
                    index.layer.setVisible(false);
                },
            });

            layer.setVisible(true);
            setTimeout(() => zoomToLayer(layer), 500);
        };

        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(() => {
            turnOffLayerGroup(map, REGIONS_GROUP);
            observe(true);
        });
    });
 };

 const disableOvservedLayerGroup = (group, except) => {
    if (!group) { return; }

    $('#layers-panel #observed-layers').find(`[data-group='${ group }']`).each((_, el) => {
        if (except && el === except) { return; }
        $(el).find('input').prop('checked', false);
    });
 };

 const updateLayersZIndex = () => {
    const totalLayers = map.getLayers().getArray().length;

    let index = 0;

    for (let observed of observedLayers) {
        if (observed.layer) {
            moveLayer(observed.layer, totalLayers - index - 1);
            index += 1;
        } else if (observed.layers) {
            const layers = observed
                .layers
                .filter((l) => !observedLayers.find(({ layer }) => layer === l));
            moveLayers(layers, totalLayers - index - 1);
            index += layers.length;
        }
    }
 };

 const buildObservedLayers = () => {
    const container = $('#observed-layers');

    $(container).empty();

    observedLayers.forEach((observedLayer) => {
        const child = buildObservedLayer(observedLayer);
        container.append(child);
    });

    updateLayersZIndex();
 };

 const buildObservedLayer = (observedLayer) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('observed-layer-wrapper');
    wrapper.id = `observed-layer-${ observedLayer.key }`;
    wrapper.setAttribute('data-group', observedLayer.group || '');
  
    const title = document.createElement('div');
    title.classList.add('observed-layer-title');
    title.textContent = observedLayer.name;
  
    const controls = document.createElement('div');
    controls.classList.add('observed-layer-controls');
  
    const toggle = createToggle({
        isOn: observedLayer.isOn,
        size: 'xs',
        hideLabels: true,
    });
  
    const remove = document.createElement('div');
    remove.classList.add('observed-layer-control');
    remove.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/></svg>';
  
    const moveUp = document.createElement('div');
    moveUp.classList.add('observed-layer-control', 'move-up');
    moveUp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/></svg>';

    const moveDown = document.createElement('div');
    moveDown.classList.add('observed-layer-control', 'move-down');
    moveDown.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/></svg>';

    controls.append(moveUp);
    controls.append(moveDown);
    controls.append(toggle);
    controls.append(remove);
    wrapper.append(title);
    wrapper.append(controls);

    const moveLayer = (diff) => {
        const currentIndex = observedLayers.findIndex((ol) => ol === observedLayer);
        const removed = observedLayers.splice(currentIndex, 1);

        observedLayers.splice(currentIndex + diff, 0, ...removed);
        buildObservedLayers();
    };

    $(moveUp).click(() => {
        $(wrapper).prev().insertAfter(wrapper);
        moveLayer(-1);
    });

    $(moveDown).click(() => {
        $(wrapper).next().insertBefore(wrapper);
        moveLayer(1);
    });
  
    $(toggle).click(() => {
        disableOvservedLayerGroup(observedLayer.group, wrapper);

        const currentIsOn = observedLayer.isOn;
        const newIsOn = !currentIsOn;

        observedLayer.isOn = newIsOn;

        if (observedLayer.onToggle) {
            observedLayer.onToggle(newIsOn);
        }
    });
  
    $(remove).click(() => {
        observedLayer.onRemove();

        if (observedLayer.layer) {
            stopObservingLayer(observedLayer.layer);
        } else if (observedLayer.key) {
            stopObservingLayerByKey(observedLayer.key);
        }

        buildObservedLayers()
    });
  
    return wrapper;
 };

 const checkEmptyObservedLayers = () => {
    if (observedLayers.length === 0) {
        $('#layers-panel-empty').removeClass('invisible');
    } else {
        $('#layers-panel-empty').addClass('invisible');
    }
 };

 const removeObservedLayer = (observed) => {
    const element = $(`#observed-layers #observed-layer-${ observed.key }`);
    element.remove();

    checkEmptyObservedLayers();
 };

 const observeLayer = (options) => {
    const layerData = {
        key: options.key,
        layer: options.layer,
        layers: options.layers,
        name: options.name,
        group: options.group,
        onToggle: options.onToggle,
        onRemove: options.onRemove,
        isOn: options.isOn,
    };
    const index = layerData.key ? observedLayers.findIndex((l) => l.key === layerData.key) : -1;

    if (index >= 0) {
        observedLayers[index] = layerData;
    } else {
        observedLayers.push(layerData);
    }

    checkEmptyObservedLayers();
    buildObservedLayers();
 };
  
 const stopObservingLayer = (layer) => {
    const index = observedLayers.findIndex((l) => l.layer === layer);
    const [ observedLayer ] = observedLayers.splice(index, 1);
  
    removeObservedLayer(observedLayer);
 };

 const stopObservingLayerByKey = (key) => {
    const index = observedLayers.findIndex((l) => l.key === key);
    const [ observedLayer ] = observedLayers.splice(index, 1);
  
    removeObservedLayer(observedLayer);
 };

 $('#ottobacias-button').click(function () {
    $('#ottobacias-content').toggleClass('active');
  
    if ($('#ottobacias-content').hasClass('active')) {
        $('#ottobacias-content').css('maxHeight', $('#ottobacias-content').prop('scrollHeight'));
    } else {
        $('#ottobacias-content').css('maxHeight', 0);
    }
 });

 $(document).ready(() => {
    $('#warning .modal-dialog').draggable();
    $('#hydrology .modal-dialog').draggable();
    $('#layers-panel').draggable();
    $('#region .modal-dialog').draggable();
    $('#obsgraph .modal-dialog').draggable();
    $('#graph .modal-dialog').draggable();
  
    buildWarningPoints();
    buildHydrology();
    buildRegions();
 });