exports.get404 = (req, res, next) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    path: null
  });
};

exports.get500 = (error, req, res, next) => { 
  console.error("The actual application error is:", error); // This prints the real bug
  res.status(500).render('500', { 
    pageTitle: 'Error!', 
    path: '/500', 
    isAuthenticated: req.session ? req.session.isLoggedIn : false 
  }); 
};
