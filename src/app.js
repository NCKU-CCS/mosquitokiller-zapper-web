if (!String.prototype.format) {
  String.prototype.format = function () {
    const args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    })
  };
}

let bucketJson = {}
let eventJson = {}
let locationJson = {}
let countJson = {}
let placeJson = {}
let mccDistanceLowerLimit
let map;
let markerArray = [];
let circles = []
let getPlaceName
let getCount
let availableDates

moment.locale('zh-tw')

let getPlaceNameFunc = function (placeJson) {
  var placeMap = {}
  placeJson.forEach(function (d) {
    placeMap[d.place_id] = d.place_name
  })
  return function (id) {
    return placeMap[id]
  }
}

var getCountFunc = (countJson) => {
  let countMap = {}
  availableDates.forEach((d) => {
    countMap[d] = {}
  })
  for (let i in countJson) {
    let dateData = countJson[i]
    for (let id in dateData)
      countMap[i][id] = dateData[id].sum
  }
  return (date) => {
    return countMap[date]
  }
}
var countryView = {
  '台南': [22.9971, 120.1926],
  '高雄': [22.6397615, 120.2999183],
  '屏東': [22.667431, 120.486307]
}

$(document).ready(function () {
  setMapTitle('資料載入中...')
  $('.range-start').datepicker({
    'autoclose': true,
    'zIndexOffset': 1000,
    'format': 'yyyy-mm-dd'
  }).on('changeDate', datepickerOnChange)
  $('.range-end').datepicker({
    'autoclose': true,
    'zIndexOffset': 1000,
    'format': 'yyyy-mm-dd'
  }).on('changeDate', datepickerOnChange)

  var root_url = 'http://140.116.249.228:3000/apis/'
  var urls = ['lamps', 'rules', 'mcc', 'counts', 'places'];
  var reqPromises = urls.map(function (url) {
    return $.ajax({
      // url: root_url + url,
      url: url + '.json',
      dataType: "JSON",
      type: "GET"
    });
  });

  Promise.all(reqPromises).then(function (res) {
    bucketJson = res[0]['lamps']
    mccDistanceLowerLimit = res[1]['rules'][0].distance_lower_limit
    eventJson = res[2]['mcc']
    countJson = res[3]['counts']
    placeJson = res[4]['places']

    console.log(res)

    availableDates = getKeys(countJson)
    getPlaceName = getPlaceNameFunc(placeJson)
    getCount = getCountFunc(countJson)
    initMap();
    setMapTitle('請選擇日期區間')
  })
});

function initMap() {
  map = L.map('map').setView(countryView["台南"], 14)

  L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'ching56.17hng6ja',
    accessToken: 'pk.eyJ1IjoiY2hpbmc1NiIsImEiOiJjaXNiZmYydGMwMTN1MnpwbnNqNWVqM2plIn0.k7h-PUGX7Tl5xLwDH3Qpsg'
  }).addTo(map);
  $("#map").hide();
  $("#map").fadeIn();

  var weekEggLegend = L.control({
    position: 'bottomright'
  });

  weekEggLegend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend'),
      grades = [0, 1, 50, 100, 150, 200];

    div.innerHTML += '<span class = "legend-header">捕獲數（個）<hr>';
    for (var i = 0; i < grades.length; i++) {
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
  $(".barrel_legend > input").on("click", function () {
    var selectedClass = '.' + $(this).val()
    if ($(this).prop("checked")) {
      $(selectedClass).css('display', 'block')
    } else {
      $(selectedClass).css('display', 'none')
    }
  })
}

function datepickerOnChange() {
  let availableDatesInInterval = []
  let dataInInterval = {}
  const startDate = moment($('.range-start').val())
  const endDate = moment($('.range-end').val())
  console.log('trigger change')

  if( startDate==='' || endDate === '')
    return

  availableDates.forEach((d) => {
    let thisDay = moment(d)
    if (thisDay >= startDate && thisDay <= endDate) {
      availableDatesInInterval.push(thisDay)
    }
  })

  availableDatesInInterval.forEach((d) => {
    let thisDayKey = d.format('YYYY-MM-DD')
    dataInInterval[thisDayKey] = getCount(thisDayKey)
  })

  

  insertBucketList(dataInInterval);
  renderEvent()
}

function insertBucketList(dateDataMap) {
  const hasStartDate = !($('.range-start').val() === '')
  const hasEndDate = !($('.range-end').val() === '')
  const startDate = hasStartDate ? moment($('.range-start').val()).format('YYYY-MM-DD') : '未選擇起始日期'
  const endDate = hasEndDate ? moment($('.range-end').val()).format('YYYY-MM-DD') : '未選擇結束日期'
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
      insertBucketHtml(place, lamp, count);
      bindPopups(lamp, count);
    }
  }

  $('#map').fadeIn()
}

function insertBucketHtml(info, bucket, count) {
  var insertHTML = `<a class="list-group-item ">
        <h4 class="list-group-item-heading"><span>${bucket.lamp_id}@${info}</span><span>&#9889;${count}</span></h4>
        <p class="list-group-item-text"> ${moment.tz(bucket.updated_at, 'Asia/Taipei').format('LLL')}</p>
      </a>`
  $(".map-container .list-group").append(insertHTML);
}

function getKeys(obj) {
  try {
    var keys = Object.keys(obj);
    return keys;
  } catch (err) {
    return [];
  }
}

function setMapTitle(mapTitle) {
  // clear loading text 
  console.log('set title', mapTitle)
  const title = $(`<h3>${mapTitle}</h3>`)
  $('.list-group').empty()
  $('.list-group').append(title)
  
  title.hide();
  title.fadeIn('slow');
}

function renderEvent(date) {
  eventJson.forEach(function (event) {
    var latlng = [event.mcc_center[1], event.mcc_center[0]]
    var radius = mccDistanceLowerLimit
    var circle = L.circle(latlng, {
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

function bindPopups(lamp, count) {

  var SCALE = 80;


  var lat = lamp.lamp_location[1]
  var lng = lamp.lamp_location[0]

  var icon = L.icon({
    iconUrl: getIconStyle(count),
    iconSize: [45, 80], // size of the icon
    popupAnchor: [0, -40],
    iconAnchor: [22, 60],
    className: getIconCat(count),
  });

  var PopUpContent = ('<table>' +
    '<tr>' +
    '<th> ID </th>' +
    '<td> {0} </td>' +
    '</tr>' +
    '<tr>' +
    '<th>地點</th>' +
    '<td>{1}</td>' +
    '</tr>' +
    '<tr>' +
    '<th>捕獲</th>' +
    '<td>{2}</td>' +
    '</tr>' +
    '</table>').format(lamp.lamp_id, getPlaceName(lamp.place_id), count)

  var marker = L.marker([lat, lng], {
      icon: icon
    })
    .bindPopup(PopUpContent).addTo(map);
  markerArray.push(marker);
}

function getIconStyle(amount) {
  var style;
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
  var category;
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
  var style;
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