var roles = ["programmer", "student", "PHP evangelist", "tech enthusiast"];
var index = 1;
setInterval(function() {
  $("span#role").fadeOut(800, function() {
    $(this).html(roles[index]);
    index++;
    if (index == roles.length) index = 0;
    $(this).fadeIn(600);
  });
}, 4000);