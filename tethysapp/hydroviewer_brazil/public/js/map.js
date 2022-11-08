const REGIONS_GROUP = 'regions';
const OTTOBACIAS_GROUP = 'ottobacias';

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
                zIndex: 100,
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
    const points = {
        streams: {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polyline points="19 1, 1 6, 19 14, 1 19" stroke="#0000FF" fill="transparent" stroke-width="2"/></svg>',
            name: 'Streams',
            layer: wmsLayer,
            isOn: true,
        },
        'all-warning': {
            name: 'All Warnings',
        },
        '100-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(128,0,246,1)" fill="rgba(128,0,246,0.4)" stroke-width="2"/></svg>',
            name: '100-Year Warnings',
            layer: hundred_year_warning,
            period: 100,
        },
        '50-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(128,0,106,1)" fill="rgba(128,0,106,0.4)" stroke-width="2"/></svg>',
            name: '50-Year Warnings',
            layer: fifty_year_warning,
            period: 50,
        },
        '25-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(255,0,0,1)" fill="rgba(255,0,0,0.4)" stroke-width="2"/></svg>',
            name: '25-Year Warnings',
            layer: twenty_five_year_warning,
            period: 25,
        },
        '10-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(255,56,5,1)" fill="rgba(255,56,5,0.4)" stroke-width="2"/></svg>',
            name: '10-Year Warnings',
            layer: ten_year_warning,
            period: 10,
        },
        '5-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(253,154,1,1)" fill="rgba(253,154,1,0.4)" stroke-width="2"/></svg>',
            name: '5-Year Warnings',
            layer: five_year_warning,
            period: 5,
        },
        '2-year-warning': {
            icon: '<svg width="20" height="20" viewPort="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><polygon points="0 20, 10 0, 20 20" stroke="rgba(254,240,1,1)" fill="rgba(254,240,1,0.4)" stroke-width="2"/></svg>',
            name: '2-Year Warnings',
            layer: two_year_warning,
            period: 2,
        },
    };

    const parent = $('#warning .modal-body');
  
    const showAll = (show) => {
        Object
            .keys(points)
            .filter((key) => key !== 'streams')
            .forEach((key) => {
            if (isEnabled(key)) { return; }
            if (!points[key].layer) { return; }
            points[key].layer.setVisible(show)
        });
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
                    if (!isAllEnabled() || key === 'streams') {
                        point.layer.setVisible(isActive);
                        checkIntersections();
                    }
                },
                onRemove: () => {
                    if (!isAllEnabled() || key === 'streams') {
                        point.layer.setVisible(false);
                        checkIntersections();
                    }
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
            isOn: key === 'level_2',
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
                    visible: false,
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
                        turnOffLayerGroup(map, item.group);   
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

 const buildOttobacias = () => {
    const parent = $('#hydrology .modal-body');
    const button = document.createElement('button');
    button.classList.add('collapsible');
    button.id = 'ottobacias-button';
    button.textContent = 'Ottobacias';
  
    const content = document.createElement('div');
    content.classList.add('collapsible-content');
    content.id = 'ottobacias-content';
  
    parent.append(button);
    parent.append(content);
  
    Object.keys(ottobacias_index).forEach((key) => {
        const index = ottobacias_index[key];
        const option = document.createElement('div');
        const title = document.createElement('div');
        const toggle = createToggle();
        toggle.classList.add('hydrology-option-toggle');
  
        option.classList.add('common-option-wrapper');
        title.classList.add('common-option-label');
        title.textContent = index.name;
  
        $(option).append(title, toggle);
        $(content).append(option);
        $(toggle).click(() => {
            const isActive = $(toggle).find('input').prop('checked');
            let layer = ottobacias_index[key].layer;

            if (!layer) {
                const geojsons = index.geojsons;
                layer = createGeojsonsLayer({
                    geojsons,
                    layerName: key,
                    group: OTTOBACIAS_GROUP,
                    visible: false,
                });

                // Caching
                ottobacias_index[key].layer = layer;
            }

            if (isActive) {
                observeLayer({
                    key,
                    layer,
                    name: index.name,
                    group: OTTOBACIAS_GROUP,
                    onToggle: (isActive) => {
                        if (isActive) {
                            turnOffLayerGroup(map, OTTOBACIAS_GROUP);   
                        }

                        layer.setVisible(isActive);
                    },
                    onRemove: () => {
                        $(toggle).find('input').prop('checked', false);
                        layer.setVisible(false);
                    },
                });
            } else {
                stopObservingLayer(layer);
                layer.setVisible(false);
            }
        });
    });
  
    $(button).click(() => {
        $(content).toggleClass('active');
  
        if ($(content).hasClass('active')) {
            $(content).css('maxHeight', $(content).prop('scrollHeight'));
        } else {
            $(content).css('maxHeight', 0);
        }
    })
 };
  
 const buildRegions = () => {
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
  
        $(option).append(title, toggle);
        $(parent).append(option);
        $(toggle).click(() => {
            disableOvservedLayerGroup(REGIONS_GROUP);
            turnOffLayerGroup(map, REGIONS_GROUP);

            let layer = region_index[key].layer;

            const onToggle = (isActive, layer) => {
                if (isActive) {
                    turnOffLayerGroup(map, REGIONS_GROUP);
                }

                layer.setVisible(isActive);
                zoomToLayer(layer);
            };

            if (!layer) {
                const geojsons = index.geojsons;
                layer = createGeojsonsLayer({
                    geojsons,
                    layerName: key,
                    group: REGIONS_GROUP,
                    noStyle: true,
                });

                // Caching
                region_index[key].layer = layer;

                observeLayer({
                    key,
                    layer,
                    name: index.name,
                    group: REGIONS_GROUP,
                    onToggle: (isActive) => onToggle(isActive, layer),
                    onRemove: () => layer.setVisible(false),
                    isOn: true,
                });
            } else {
                enableOvservedLayer(key);
                onToggle(true, layer);
            }
        });
    });
 };

 const enableOvservedLayer = (key) => {
    $(`#layers-panel #observed-layers #observed-layer-${ key }`)
        .find('input')
        .prop('checked', true);
 };

 const disableOvservedLayerGroup = (group, except) => {
    if (!group) { return; }

    $('#layers-panel #observed-layers').find(`[data-group='${ group }']`).each((_, el) => {
        if (except && el === except) { return; }
        $(el).find('input').prop('checked', false);
    });
 };

 const buildObservedLayer = (observedLayer, isOn) => {
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
        isOn,
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

    $(moveUp).click(() => {
        $(wrapper).prev().insertAfter(wrapper);
    });

    $(moveDown).click(() => {
        $(wrapper).next().insertBefore(wrapper);
    });
  
    $(toggle).click(() => {
        disableOvservedLayerGroup(observedLayer.group, wrapper);

        const isOn = $(toggle).find('input').prop('checked');

        if (observedLayer.onToggle) {
            observedLayer.onToggle(isOn);
        }
    });
  
    $(remove).click(() => {
        observedLayer.onRemove();

        if (observedLayer.layer) {
            stopObservingLayer(observedLayer.layer);
        } else if (observedLayer.key) {
            stopObservingLayerByKey(observedLayer.key);
        }
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

 const addObservedLayer = (observed, isOn) => {
    checkEmptyObservedLayers();
  
    const container = $('#observed-layers');
    const child = buildObservedLayer(observed, isOn);
    
    container.append(child);
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
        name: options.name,
        group: options.group,
        onToggle: options.onToggle,
        onRemove: options.onRemove,
    };
    const index = layerData.key ? observedLayers.findIndex((l) => l.key === layerData.key) : -1;

    if (index >= 0) {
        observedLayers[index] = layerData;
    } else {
        observedLayers.push(layerData);
    }

    addObservedLayer(layerData, options.isOn);
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
 
 const findObservedLayerByKey = (key) => {
    const index = observedLayers.findIndex((l) => l.key === key);
    return index >= 0 ? observedLayers[index] : null;
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
    $('#warning').draggable();
    $('#hydrology').draggable();
    $('#layers-panel').draggable();
    $('#region').draggable();
  
    buildWarningPoints();
    buildHydrology();
    buildRegions();
 });