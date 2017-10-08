import style from './mapStyle'
let bucketJson = []
let eventJson = []
let countJson = []
let placeJson = []
let mccDistanceLowerLimit
let map;
let markerArray = [];
let circles = []
let getPlaceName
let getCount
let availableDates

const countryView = {
  '台南': [22.9971, 120.1926],
  '高雄': [22.6397615, 120.2999183],
  '屏東': [22.667431, 120.486307]
}

let getPlaceNameFunc = function (placeJson) {
  let placeMap = {}
  placeJson.forEach(function (d) {
    placeMap[d.place_id] = d.place_name
  })
  return function (id) {
    return placeMap[id]
  }
}

let getCountFunc = (countJson) => {
  let countMap = {}
  availableDates.forEach((d) => {
    countMap[d] = {}
  })
  for (let i in countJson) {
    let dateData = countJson[i]
    for (let id in dateData)
      countMap[i][id] = +dateData[id].sum
  }
  return (date) => {
    return countMap[date]
  }
}

moment.locale('zh-tw')

$(document).ready(function () {
  setMapTitle('資料載入中...')

  $('.range-start, .range-end').datepicker({
    'autoclose': true,
    'zIndexOffset': 1000,
    'format': 'yyyy-mm-dd',
    'disableTouchKeyboard': true
  }).on('changeDate', datepickerOnChange)

  const root_url = 'https://mosquitokiller.csie.ncku.edu.tw/apis/'
  const urls = ['lamps', 'rules', 'mcc', 'counts?formatBy=date', 'places'];

  const reqPromises = urls.map(function (url) {
    return $.ajax({
      url: root_url + url,
      dataType: "JSON",
      type: "GET"
    });
  });

  Promise.all(reqPromises).then(function (res) {
    console.log(res)
    let rule
    [ bucketJson, rule, eventJson,
      countJson, placeJson] = res

    mccDistanceLowerLimit = rule[0].distance_lower_limit

    availableDates = getKeys(countJson)
    getPlaceName = getPlaceNameFunc(placeJson)
    getCount = getCountFunc(countJson)

    initMap();
    setMapTitle('請選擇日期區間')

  }).catch((err)=>{
    console.log(err)
    setMapTitle(`資料錯誤：${err.status} ${err.statusText}`)
  })
});

function initMap() {
  map = L.map('map').setView(countryView["台南"], 14)
  const roads = L.gridLayer.googleMutant({
    type: 'roadmap', // valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
    styles: style,
  }).addTo(map)

  $("#map").hide();
  $("#map").fadeIn();

  const weekEggLegend = L.control({
    position: 'bottomright'
  });

  weekEggLegend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend'),
      grades = [0, 1, 50, 100, 150, 200];

    div.innerHTML += '<span class = "legend-header">捕獲數（個）<hr>';
    for (let i = 0; i < grades.length; i++) {
      if (grades[i] === 0) {
        div.innerHTML += '<div class=" barrel_legend" id="grade_' + i + '">' + '<i style="background:' + getIconStyleRGBA(grades[i]) + '"></i>' + grades[i] + '<br></div>';
      } else {
        div.innerHTML += '<div class=" barrel_legend" id="grade_' + i + '">' + '<i style="background:' + getIconStyleRGBA(grades[i]) + '"></i>' + grades[i] + (grades[i + 1] ? ' &ndash; ' + (grades[i + 1] - 1) + '<br></div>' : ' <br></div>');
      }
    }

    div.innerHTML += '<div class=" barrel_legend" id="grade_other">' + '<i style="background:#cccccc"></i>' + '無資料' + '<br></div>';

    return div;
  };

  weekEggLegend.addTo(map);
}

function datepickerOnChange() {
  let dataInInterval = {}
  const startDate = moment($('.range-start').val())
  const endDate = moment($('.range-end').val())
  const events = eventJson.slice().filter((d) => {
    const eventDate = moment.tz(d.created_at, 'Asia/Taipei')
    return eventDate <= endDate && eventDate >= startDate
  })

  if( startDate==='' || endDate === '')
    return

  availableDates.forEach((d) => {
    let thisDay = moment(d)
    if (thisDay >= startDate && thisDay <= endDate) {
      let thisDayKey = thisDay.format('YYYY-MM-DD')
      dataInInterval[thisDayKey] = getCount(thisDayKey)
    }
  })

  insertBucketList(dataInInterval);
  renderEvent(events)
}

function insertBucketList(dateDataMap) {
  const hasStartDate = !($('.range-start').val() === '')
  const hasEndDate = !($('.range-end').val() === '')
  const startDate = hasStartDate ? moment($('.range-start').val()).format('YYYY-MM-DD') : '未選擇起始日期'
  const endDate = hasEndDate ? moment($('.range-end').val()).format('YYYY-MM-DD') : '未選擇結束日期'
  const lampSumData = {}
  $(".map-container .list-group").empty();
  clearMap();

  if (getKeys(dateDataMap).length === 0) {
    let info = '沒有資料'
    if (!hasEndDate || !hasStartDate) {
      info = ''
    }
    setMapTitle(`${startDate} ~ ${endDate} ${info}`)
  } else {
    setMapTitle(`${startDate} ~ ${endDate} 區間資料`)
  }

  for (let date in dateDataMap) {
    let thisDayCountData = dateDataMap[date]
    for (let id in thisDayCountData) {
      const count = thisDayCountData[id]
      const lamp = bucketJson.find((d) => {
        return d.lamp_id === id
      })
      const place = getPlaceName(lamp.place_id)
      insertBucketHtml(place, lamp, count, date);
      if (!lampSumData[lamp.lamp_id]) {
        lampSumData[lamp.lamp_id] = {}
        lampSumData[lamp.lamp_id].lamp = lamp
        lampSumData[lamp.lamp_id].count = 0
      }
      const lampCount = lampSumData[lamp.lamp_id].count
      lampSumData[lamp.lamp_id].count = lampCount + count
    }
  }
  bindPopups(lampSumData);
  $('#map').fadeIn()
}

function insertBucketHtml(info, bucket, count, date) {
  const insertHTML = `<a class="list-group-item ">
        <h4 class="list-group-item-heading"><span>${bucket.lamp_id}@${info}</span><span>&#9889;${count}</span></h4>
        <p class="list-group-item-text"> ${moment(date).format('LL')}</p>
      </a>`
  $(".map-container .list-group").append(insertHTML);
}

function getKeys(obj) {
  try {
    const keys = Object.keys(obj);
    return keys;
  } catch (err) {
    return [];
  }
}

function setMapTitle(mapTitle) {
  // clear loading text 
  const title = $(`<h3>${mapTitle}</h3>`)
  $('.list-group').empty()
  $('.list-group').append(title)
  
  title.hide();
  title.fadeIn('slow');
}

function renderEvent(events) {
  events.forEach(function (event) {
    const latlng = [event.mcc_center[1], event.mcc_center[0]]
    const radius = mccDistanceLowerLimit
    const circle = L.circle(latlng, {
      radius: radius
    })
    circles.push(circle)
    circle.addTo(map);
  })
}

function clearMap() {
  markerArray.forEach(function (marker) {
    map.removeLayer(marker);
  });

  circles.forEach(function (circle) {
    circle.remove()
  })

  circles = []

  $("#map").hide();
}

function bindPopups(lampSumData) {

  const SCALE = 80;

  for( let id in lampSumData ){
    const lamp = lampSumData[id].lamp
    const count = lampSumData[id].count
    const lat = lamp.lamp_location[1]
    const lng = lamp.lamp_location[0]
    const icon = L.icon({
      iconUrl: getIconStyle(count),
      iconSize: [45, 80], // size of the icon
      popupAnchor: [0, -40],
      iconAnchor: [22, 60],
      className: getIconCat(count),
    });
    const PopUpContent = (`<table>
      <tr>
        <th> ID </th>
        <td> ${lamp.lamp_id} </td>
      </tr>
      <tr>
        <th>地點</th>
        <td>${getPlaceName(lamp.place_id)}</td>
      </tr>
        <tr>
        <th>捕獲</th>
        <td>${count}</td>
      </tr>
      </table>`)
    const marker = L.marker([lat, lng], {
      icon: icon
    }).bindPopup(PopUpContent).addTo(map);
    markerArray.push(marker);
  }
  if( markerArray.length > 0){
    const group = new L.featureGroup(markerArray);
    console.log(map)
    map.fitBounds(group.getBounds(),{
      maxZoom: 17,
    });
  } 
}

function getIconStyle(amount) {
  let style;
  if (amount === 0) {
    style = 'legend1';
  } else if (amount > 0 && amount <= 49) {
    style = 'legend2';
  } else if (amount >= 50 && amount <= 99) {
    style = 'legend3';
  } else if (amount >= 100 && amount <= 149) {
    style = 'legend4';
  } else if (amount >= 150 && amount <= 199) {
    style = 'legend5';
  } else if (amount >= 200) {
    style = 'legend6';
  } else {
    style = 'legend_undefined';
  }
  return 'images/' + style + '.svg';
}

function getIconCat(amount) {
  let category;
  if (amount === 0) {
    category = 'grade_0';
  } else if (amount > 0 && amount <= 49) {
    category = 'grade_1';
  } else if (amount >= 50 && amount <= 99) {
    category = 'grade_2';
  } else if (amount >= 100 && amount <= 149) {
    category = 'grade_3';
  } else if (amount >= 150 && amount <= 199) {
    category = 'grade_4';
  } else if (amount >= 200) {
    category = 'grade_5';
  } else {
    category = 'grade_other';
  }
  return category;
}

function getIconStyleRGBA(amount) {
  let style;
  if (amount === 0) {
    style = '#00FF9D';
  } else if (amount > 0 && amount <= 49) {
    style = '#33CC7E';
  } else if (amount >= 50 && amount <= 99) {
    style = '#66995E';
  } else if (amount >= 100 && amount <= 149) {
    style = '#99663F';
  } else if (amount >= 150 && amount <= 199) {
    style = '#CC331F';
  } else if (amount >= 200) {
    style = '#FF0000';
  }

  return style;
}