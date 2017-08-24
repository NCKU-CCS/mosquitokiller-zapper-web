// string format
if (!String.prototype.format) {
  String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    })
  };
}

var bucketJson = {};
var eventJson = {};
var locationJson = {};
var map;
var heat;
var markerArray = [];
var circles = []
var dangerClusterLayer;
var countryView = {
  '台南': [22.9971, 120.2126],
  '高雄': [22.6397615, 120.2999183],
  '屏東': [22.667431, 120.486307]
}
$('#datetimepicker').datetimepicker({
  format: 'YYYY-MM-DD'
})
$("#datetimepicker").on("dp.change", function () {
  var date = $("#datetimepicker").val();
  insertBucketList(date);
  updateMapTitle(date);
  drawEvent(date)
  resetLegendCheckbox();
});

$(document).ready(function () {
  $('#map-name').html('<h3 class="text-center">資料載入中...</h3>');
  var urls = ['0809-0816.json', 'location.json', '0809-0816-mcc.json'];
  var reqPromises = urls.map(function (url) {
    return $.ajax({
      url: url,
      dataType: "JSON",
      type: "GET"
    });
  });

  Promise.all(reqPromises).then(function (res) {
    bucketJson = res[0]['bucket-record']
    locationJson = res[1]
    eventJson = res[2]['mccs']
    initMap();
    $('#datetimepicker').val('2017-08-09');
    $("#datetimepicker").trigger("change");
  })
});

function initMap(){
  map = L.map('map').setView(countryView["台南"], 14)
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'ching56.17hng6ja',
    accessToken: 'pk.eyJ1IjoiY2hpbmc1NiIsImEiOiJjaXNiZmYydGMwMTN1MnpwbnNqNWVqM2plIn0.k7h-PUGX7Tl5xLwDH3Qpsg'
  }).addTo(map);
  heat = L.heatLayer([], {
    minOpacity: 0.4,
    radius: 40,
    blur: 20, //越小越精確、越大heat lose 越多
    gradient: {
      0.4: 'SlateBlue',
      0.6: 'Gold',
      1: 'red',
    }
  });
  $("#map").hide();

  var avgEggLegend = L.control({
    position: 'bottomright'
  });
  var weekEggLegend = L.control({
    position: 'bottomright'
  });
  avgEggLegend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend legend-heat');
    div.innerHTML += '<span class = "legend-header"><img src="images/heat.svg" width="18px" height="18px">&emsp;過去平均捕獲數（個）</img><hr>'
    div.innerHTML += '<i style="background:linear-gradient(to bottom, rgba(106,90,205,0.7) 0%,rgba(255,215,0,0.4) 50%,rgba(255,0,0,1) 100%);"></i>';
    div.innerHTML += '<div class="text-center">0<br>&#8768;<br>80 +</div>' //過去平均卵數legend 標示

    return div;
  };

  weekEggLegend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend'),
      grades = [0, 1, 50, 100, 150, 200];

    div.innerHTML += '<span class = "legend-header"><img src="images/location.svg" width="18px" height="18px">&emsp;&emsp;&emsp;捕獲數（個）&emsp;&emsp;</img><hr>';
    for (var i = 0; i < grades.length; i++) {
      if (grades[i] === 0) {
        div.innerHTML += '<div class=" barrel_legend" id="grade_' + i + '">' + '<input class="legendcheckbox" type="checkbox" checked="checked" value="grade_' + i + '"><i style="background:' + getIconStyleRGBA(grades[i]) + '"></i>' + grades[i] + '<br></div>';
      } else {
        div.innerHTML += '<div class=" barrel_legend" id="grade_' + i + '">' + '<input class="legendcheckbox" type="checkbox" checked="checked" value="grade_' + i + '"><i style="background:' + getIconStyleRGBA(grades[i]) + '"></i>' + grades[i] + (grades[i + 1] ? ' &ndash; ' + (grades[i + 1] - 1) + '<br></div>' : ' <br></div>');
      }
    }

    div.innerHTML += '<div class=" barrel_legend" id="grade_other">' + '<input class="legendcheckbox" type="checkbox" checked="checked" value="grade_' + i + '"><i style="background:#cccccc"></i>' + '其他' + '<br></div>';

    return div;
  };

  avgEggLegend.addTo(map);
  weekEggLegend.addTo(map);
  $(".barrel_legend > input").on("click", function () {
    var selectedClass = '.' + $(this).val()
    console.log(selectedClass)
    if ($(this).prop("checked")) {
      $(selectedClass).css('display', 'block')
    } else {
      $(selectedClass).css('display', 'none')
    }
  })
}

function insertBucketList(date) {
  $("#bucket-list").empty();
  clearMap();
  var insertBucketJson = []
  bucketJson.forEach(function (bucket) {
    if (date !== bucket.investigate_date)
      return;
    var bucketAddress = "{0}{1}{2}".format(bucket.county, bucket.town, bucket.village);
    insertBucketJson.push({
      egg_count: bucket.egg_count,
      avg_egg_count: getAvgEggCount(bucket.bucket_id, bucket.investigate_date),
      village: bucket.village,
      bucket_id: bucket.bucket_id,
      investigate_date: bucket.investigate_date
    });
    insertBucketHtml(bucketAddress, bucket);
  })
  updateMap(date, insertBucketJson);
}

function getAvgEggCount(bucketId, date) {
  var sumEggCount = 0;
  var bucketsBeforeDate = 0;
  bucketJson.forEach(function (bucket) {
    if (bucket.bucket_id !== bucketId){
      return
    }
    var thisDate = moment(bucket.investigate_date)
    var isBefore = thisDate.isBefore(moment(date))
    console.log(thisDate, moment(date))
    if(isBefore){
      sumEggCount += bucket.egg_count
      bucketsBeforeDate++
    }
  })
  return bucketsBeforeDate === 0 ? 0 : sumEggCount / bucketsBeforeDate
}

function insertBucketHtml(bucketAddress, bucket) {
  var insertHTML =
    ('<div class="col-md-3 col-xs-12">' +
      '<div class="panel panel-default">' +
      '<div class="panel-heading text-center">' +
      '<h3 class="panel-title">{0}</h3>' +
      '<span>{1}</span>' +
      '</div>' +
      '<div class="panel-body">' +
      '<p>捕獲：{2}</p>' +
      '<p>孑孓：{5}</p>' +
      '<p>埃及幼蟲：{6}</p>' +
      '<p>白線幼蟲：{7}</p>' +
      '<p>備註：{8}</p>' +
      '</div>' +
      '</div>' +
      '</div>')
      .format(bucket.bucket_id, bucketAddress,
      bucket.egg_count, bucket.egypt_egg_count,
      bucket.white_egg_count, bucket.larvae_count,
      bucket.egypt_larvae_count, bucket.white_larvae_count,
      bucket.note);
  $("#bucket-list").append(insertHTML);
}

function getKeys(obj) {
  try {
    var keys = Object.keys(obj);
    return keys;
  } catch (err) {
    return [];
  }
}

function updateMapTitle(date) {
  var mapTitle = '<h3 class="text-center"> '+ date +' 台南捕蚊燈資訊 </h3>';

  $('#map-name').hide();
  $('#map-name').html(mapTitle);
  $('#map-name').fadeIn('slow');

}

function drawEvent(date){
  eventJson.forEach(function(event) {
    if(date !== event.created_at)
      return
    var latlng = [event.center[1], event.center[0]]
    var radius = event.distance
    var circle = L.circle(latlng, { radius: radius })
    circles.push(circle)
    circle.addTo(map);
  })
}

function clearMap() {
  heat.remove();
  markerArray.forEach(function (marker) {
    map.removeLayer(marker);
  });

  circles.forEach(function (circle){
    circle.remove()
  })

  circles = []

  heat = L.heatLayer([], {
    minOpacity: 0.4,
    radius: 40,
    blur: 20, //越小越精確、越大heat lose 越多
    gradient: {
      0.4: 'SlateBlue',
      0.6: 'Gold',
      1: 'red',
    }
  });

  $("#map").hide();
}

function updateMap(date, buckets) {

  var SCALE = 80;

  buckets.forEach(function (bucket) {
    if(date !== bucket.investigate_date)
      return
    var lat = locationJson[bucket.bucket_id].lat;
    var lng = locationJson[bucket.bucket_id].lng;
    var eggNem = bucket.egg_count;
    var village = bucket.village;
    var avgEggNum = bucket.avg_egg_count;
    console.log(avgEggNum)
    if (avgEggNum !== 0) 
      heat.addLatLng([lat, lng, avgEggNum / SCALE]);

    var icon = L.icon({
      iconUrl: getIconStyle(eggNem),
      iconSize: [45, 80], // size of the icon
      popupAnchor: [0, -40],
      iconAnchor: [22, 60],
      className: getIconCat(eggNem),
    });

    var marker = L.marker([lat, lng], {
        icon: icon
      })
      .bindPopup(
        ('<table>' +
          '<tr>' +
          '<th>id</th>' +
          '<td>{0}</td>' +
          '</tr>' +
          '<tr>' +
          '<th>捕獲數</th>' +
          '<td>{1}</td>' +
          '</tr>' +
          '<tr>' +
          '<th>里</th>' +
          '<td>{2}</td>' +
          '</tr>' +
          '</table>').format(bucket.bucket_id, eggNem, village))
      .addTo(map);
    markerArray.push(marker);
  });

  $("#map").show();
  heat.addTo(map);
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

function resetLegendCheckbox() {
  $('.legendcheckbox').prop('checked', true);
}