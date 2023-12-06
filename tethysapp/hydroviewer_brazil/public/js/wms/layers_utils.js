/***
  * Updates the current visibility of a given layer.
  * 
  * @param isLayerVisible controls whether a layer should be visible or not.
 */
function setIsLayerVisible(layer, isLayerVisible) {
    if (isLayerVisible) {
        layer.show()
    } else {
        layer.hide()
    }
}

function zoomToLayer(layer) {
    if (layer.isHidden() === true) return;

    setTimeout(() => {
        var group = new L.featureGroup([layer]);
        map.fitBounds(group.getBounds());
    }, 10);
}

function hideLayerGroup(layerGroup) {
    const layers = layerGroup.getLayers();

    layers.forEach((item) => {
        item.hide()
    })
}

async function createGeoJSONLayer(options) {
    const {
        key,
        staticGeoJson,
        geojsons,
        group,
        visible = true,
        getStyleFunction,
    } = options;

    for (let i in geojsons) {
        const regionsSource = await getGeoJSONFromURL(staticGeoJson + geojsons[i]);

        const regionsLayer = L.geoJSON(regionsSource.features, { pane: key, style: getStyleFunction });
        group.addLayer(regionsLayer);

        setIsLayerVisible(regionsLayer, visible)

        setTimeout(() => zoomToLayer(regionsLayer), 500);

        return regionsLayer;
    }
}

/***
 * Reads the contents from a given [url] and tries to parse it to a JSON object.
 * If any errors occur during this process, an object containing all of the details
 * from the error will be returned instead.
 * 
 * @params url - the source from which to load a GeoJSON.
 * 
 * @returns a JSON object containing the contents of the url, or an error object.
*/
function getGeoJSONFromURL(url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(JSON.parse(xhr.response));
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}