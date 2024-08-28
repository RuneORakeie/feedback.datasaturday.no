function graphObject(definition) {
    const spacingX=definition.horizontalSpacing || 0.2;

    var minX=0;
    var maxX=0;
    var minY=0;
    var maxY=0;
    var barWidth=0;

    if (definition.bars) {
        minX=definition.bars.reduce((agg, curr) => (curr.x<agg ? curr.x : agg), minX);
        maxX=definition.bars.reduce((agg, curr) => (curr.x>agg ? curr.x : agg), maxX);
        minY=definition.bars.reduce((agg, curr) => (curr.y<agg ? curr.y : agg), minY);
        maxY=definition.bars.reduce((agg, curr) => (curr.y>agg ? curr.y : agg), maxY);
        barWidth=100/(maxX+1-minX)/(1+spacingX);
    }

    if (definition.points) {
        minX=definition.points.reduce((agg, curr) => (curr.x<agg ? curr.x : agg), minX);
        maxX=definition.points.reduce((agg, curr) => (curr.x>agg ? curr.x : agg), maxX);
        minY=definition.points.reduce((agg, curr) => (curr.y<agg ? curr.y : agg), minY);
        maxY=definition.points.reduce((agg, curr) => (curr.y>agg ? curr.y : agg), maxY);
    }

    const graphScaleY=98/(maxY-minY);
    const graphZeroY=(minY<0 ? 0-minY : 0);

    var graphElement=document.createElement('graph');

    if (definition.xAxis) {
        var axisElement=document.createElement('axis');
        axisElement.style.left='0%';
        axisElement.style.width='100%';
        axisElement.style.bottom=(graphScaleY*graphZeroY)+'%';
        axisElement.style.height='1px';
        graphElement.appendChild(axisElement);
    }

    // Bars
    if (definition.bars) {
        for (const bar of definition.bars) {

            var barElement=document.createElement('bar');
            barElement.style.left=(((bar.x-minX)-0.5)*barWidth*(1+spacingX))+'%';
            if (bar.shift) {
                barElement.style.left='calc('+barElement.style.left+' + '+bar.shift+')';
            }
            if (bar.width) {
                barElement.style.width=(bar.width*barWidth*(1+spacingX)-barWidth*spacingX)+'%';
            } else {
                barElement.style.width=barWidth+'%';
            }

            barElement.style.bottom=(graphScaleY*graphZeroY)+'%';
            barElement.style.height=Math.abs(graphScaleY*bar.y)+'%';
            if (bar.y<0) {
                barElement.style.bottom=(graphScaleY*(graphZeroY+bar.y))+'%';
                barElement.style.marginBottom='-1px';
            }

            if (bar.color) { barElement.style.backgroundColor=bar.color; }
            if (bar.class) {
                for (cssClass of bar.class.trim().split(' ')) {
                    barElement.classList.add(cssClass);
                }
            }

            barElement.setAttribute('data-tooltip', bar.tooltip || '');
            barElement.setAttribute('data-value', bar.y);

            graphElement.appendChild(barElement);
        }
    }

    // Points
    if (definition.points) {
        for (const point of definition.points) {

            var pointElement=document.createElement('point');
            pointElement.style.left=((point.x-minX)*barWidth*(1+spacingX)-barWidth*spacingX/2)+'%';

            pointElement.style.bottom=Math.abs(graphScaleY*(graphZeroY+point.y))+'%';

            if (point.color) { pointElement.style.backgroundColor=point.color; }
            if (point.class) { pointElement.classList.add(point.class); }

            pointElement.setAttribute('data-tooltip', point.tooltip || '');

            graphElement.appendChild(pointElement);
        }
    }

    return graphElement;
}
