const DEFAULT_COLOR = "#6A666E"; // [106, 102, 110]
const HUNDRED_YEAR_WARNING_COLOR = "#8000F6"; // [128, 0, 246]
const FIFTY_YEAR_WARNING_COLOR = "#80006A"; // [128, 0, 106]
const TWENTY_FIVE_YEAR_WARNING_COLOR = "#FF0000"; // [255, 0, 0]
const TEN_YEAR_WARNING_COLOR = "#FF3805"; // [255, 56, 5]
const FIVE_YEAR_WARNING_COLOR = "#FD9A01"; //[253, 154, 1]
const TWO_YEAR_WARNING_COLOR = "#FEF001"; // [254, 240, 1]
const REGION_COLOR = "#006400"; // [0, 100, 0]
const NEUTRAL_COLOR = "#2E8B57"; // [46, 139, 87]

function applyWarningPointStyle(feature, period, point) {
    const flow = point[4]
    const peaks = point[5]
    const exceed = point[6]

    switch (period) {
        case 2:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: TWO_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break

        case 5:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: FIVE_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break

        case 10:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: TEN_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break

        case 25:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: TWENTY_FIVE_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break

        case 50:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: FIFTY_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break

        case 100:
            feature.setStyle(
                warningPointStyle({
                    feature,
                    color: HUNDRED_YEAR_WARNING_COLOR,
                    flow,
                    peaks,
                    exceed,
                })
            )
            break
    }
}

function warningPointStyle({
    feature,
    color,
    flow,
    peaks,
    exceed,
}) {
    const layerIndex =
        observedLayers.length -
        (observedLayers.findIndex(({ layer }) => layer === feature) ??
            observedLayers.length);

    const alpha = peaks === 0 ? 1 : peaks === 1 ? 0.5 : 0.1;
    const strokes = peaks === 0 ? 1 : peaks === 2 ? 0.5 : 0.1;

    let style = {
        fillOpacity: 1,
        font: "14px Calibri,sans-serif",
        text: exceed === "0" ? "" : exceed,
        offsetX: 10,
        offsetY: -10,
        zIndex: layerIndex,
    }

    if (flow === "same") {
        style = {
            ...style,
            color: 'black',
            fillColor: color,
            opacity: alpha,
            fillOpacity: alpha,
            weight: strokes,
            radius: 0.2,
            zIndex: layerIndex,
        }
    } else if (flow === "up" || flow === "down") {
        style = {
            ...style,
            radius: 4,
            color: 'black',
            fillColor: color,
            opacity: alpha,
            fillOpacity: alpha,
            weight: strokes,
            points: 3,
            zIndex: layerIndex,
        }
    }

    return style
}

/***
 * Given a feature, this function will resolve which is the correct style for it.
 *
 * @param feature - the of the feature we want to get the style for.
 *
 * @returns CSS like object containing the feature style.
 */
function getFeatureStyle() {
    return {
        color: DEFAULT_COLOR,
        fillColor: "transparent",
        zIndex: 1,
        weight: 2
    };
}

function regionsStyle() {
    return {
        color: REGION_COLOR,
        fillColor: "transparent",
        zIndex: 1,
        weight: 2
    }
};