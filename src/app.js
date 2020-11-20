const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');

const app = express();

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'miniProject'
});

conn.connect((err) => {
    if(err) console.log("Some database error" + err);
});

// middle ware
const isAuthenticated = (req, res, next) => {
    if(req.userId) { console.log(req.userId); return next(); }
    res.redirect('/');
}

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(cors());

app.get('/', (req, res) => {
    res.render('templates/home', { title: "home", user: "check"});
});

app.route('/login/:user')
    .get((req, res) => {
        const { user } = req.params;
        const { error = false } = req.query;

        if (user === 'candidate' || user === 'recuireter') {
            res.render('templates/login', { title: "Login", userType: user, error });
        } else {
            return res.send('Invalid user');
        }
    })
    .post((req, res) => {
        const { username, password, userType } = req.body;

        const query = `
        SELECT COUNT(*) AS ex FROM loginCredential WHERE username='${username}' AND password='${password}' AND userType='${userType}';`;
        conn.query(query, (err, results) => {
            if(err) {
                console.log('Some server error', err);
                return res.redirect(`/login/${userType}?error=true`);
            }
            
            const { ex: exist } = results[0];
            if(exist) {
                req.userId = username;
                return res.redirect(`/${userType}/dashboard?id=${username}`);
            } else {
                return res.redirect(`/login/${userType}?error=true`);
            }
        });
    });

app.route('/register/:user')
    .get((req, res) => {
        const { user } = req.params;console.log(user);

        if(user === 'candidate')
            return res.render('templates/registerForCandidate', {userType: user, candidate: [], edit: false});
        else {
            const query = `SELECT comp_id, companyName FROM company ORDER BY companyName`;
            conn.query(query, (err, companys) => {
            if(err) { console.log(err); res.redirect(`login/${userType}`)};

            // console.log(companys);

            res.render('templates/registerForRecuireter', { companys, newUser: false, userType: user, edit: false, company: {} });
        });
        }
    })
    .post((req, res) => {
        const { user } = req.params;
        let cand1 = req.body;

        let cand = {};
        Object.keys(cand1).forEach((key) => {
            if(key !== 'password') cand[key] = cand1[key];
        });
        
        if(user === 'candidate') {
            let query = 'SELECT cand_id FROM candidates ORDER BY cand_id DESC LIMIT 1';

            conn.query(query, (err, results) => {
                if(err) {console.log('Some error', err); return res.redirect(`/register/${user}`)}

                let { cand_id } = results[0] != undefined ? results[0] : {};
                if(!cand_id) 
                    cand_id = "Cand1";
                else 
                    cand_id = cand_id.substr(0, 4) + (parseInt(cand_id.substr(4)) + 1).toString();

                    cand.cand_id = cand_id;
                    query = `INSERT INTO candidates SET  ?;`;
                    conn.query(query, cand, (err, results) => {
                        if(err) {console.log(err); return res.redirect('/register/' + user)}
                        
                        conn.query(`INSERT INTO loginCredential(username, password, userType) VALUES('${cand_id}', '${cand1.password}', '${user}')`, (err, results) => {
                            if(!err) {
                                console.log('got insiede');
                                return res.redirect(`/${user}/dashboard?id=${cand_id}`);
                            } else {
                                console.log(err);
                            }
                        });
                        
                    });
                });
        } else {console.log(req.body);
            let query = 'SELECT rec_id FROM recuireters ORDER BY rec_id DESC LIMIT 1';

            conn.query(query, (err, results) => {
                if(err) {console.log('Some error', err); return res.redirect(`/register/${user}`)}

                let { rec_id } = results[0] != undefined ? results[0] : {};
                if(!rec_id) 
                    rec_id = "Recu1";
                else 
                    rec_id = rec_id.substr(0, 4) + (parseInt(rec_id.substr(4)) + 1).toString();
                    
                    query = `INSERT INTO recuireters VALUES ('${rec_id}', '${cand.hrName}', '${cand.comp_id}');`;
                    conn.query(query, (err, results) => {
                        if(err) {console.log(err); return res.redirect('/register/' + user)}
                        
                        conn.query(`INSERT INTO loginCredential(username, password, userType) VALUES('${rec_id}', '${cand1.password}', '${user}')`, (err, results) => {
                            if(!err) {
                                console.log('got here');
                                return res.redirect(`/${user}/dashboard?id=${rec_id}`);
                            }
                        });
                    });
                });
        }
    });

app.get('/:userType/dashboard',(req, res) => {
    const { id } = req.query;
    const { userType } = req.params;
    
    if(userType === 'candidate') {
        res.redirect(`/candidate/allJobs?id=${id}`);
    } else {
        res.render('templates/recuireterDashboard', { id, userType });
    }
});

app.route('/addNewCompany')
    .get((req, res) => {
        res.render('templates/registerForRecuireter', { companys: [], userType: "recuireter", edit: false, company: {} });
    })
    .post((req, res) => {   
        const company = req.body;

        conn.query(`SELECT comp_id FROM company ORDER BY CAST(SUBSTR(comp_id, 5) AS UNSIGNED) DESC LIMIT 1`, (err, result) => {
            if(err) { return console.log(err); }

            let { comp_id } = result[0] ? result[0] : {}; 

            if(!comp_id) comp_id = 'COMP1';
            else comp_id = comp_id.substr(0, 4) + (parseInt(comp_id.substr(4)) + 1).toString();

            // company.comp_id = comp_id;
            req.body.comp_id = comp_id;

            let query = `INSERT INTO company VALUES('${comp_id}', '${company.companyName}', '${company.companyWorking}', '${company.departments}', '${company.branches}');`
            conn.query(query, (err, results) => {
                if(err) return console.log(err);

                return res.redirect(308, `/register/recuireter`);
            });
        });
    });

app.get('/:userType/allJobs', (req, res) => {
    const { id } = req.query;
    const { userType } = req.params;
    if(userType === 'candidate') {
    
        const query = `SELECT * FROM jobs, company WHERE jobs.comp_id = company.comp_id ORDER BY jobAdded DESC;`;
        conn.query(query, (err, jobs) => {
            if(err) {console.log(err); jobs = [];}
            // console.log(jobs);
            res.render('templates/candidateDashboard', { jobs, cand_id: id });
        });
    } else {
        const {id: rec_id} = req.query;
        
        let query = `SELECT * FROM jobs, recuireters R WHERE jobs.rec_id = R.rec_id AND jobs.rec_id='${rec_id}' ORDER BY jobAdded DESC;`;

        conn.query(query, (err, results) => {
            if(!err) {
                let jobs = results ? results : [];
console.log(jobs);
                res.render('templates/allJobs', {jobs, id: rec_id})
            }console.log(err);
        });
    }
    
});

app.route('/:userType/editProfile')
    .get((req, res) => {
        const { id } = req.query;
        const { userType } = req.params;

        if( userType === 'candidate') {
            let query = `SELECT * FROM candidates, loginCredential WHERE cand_id='${id}';`;
            conn.query(query, (err, results) => {
                if(err) console.log(err);

                let candidate = results[0];
                res.render('templates/registerForCandidate', {candidate, userType, edit: true});
            });
        } else {
            let query = `SELECT * FROM recuireters, loginCredential, company WHERE rec_id='${id}';`;
            conn.query(query, (err, results) => {
                if(err) console.log(err);

                let company = results[0] ? results[0] : {};console.log(company);
                res.render('templates/registerForRecuireter', {company, companys: [], userType, edit: true});
            });
        }
    })
    .post((req, res) => {
        const { userType } = req.params;

        if(userType === 'candidate') {
            let candidate = {};
            
            Object.keys(req.body).forEach(key => {
                if(key != 'password') candidate[key] = req.body[key];
            });

            let query = `UPDATE candidates SET ? WHERE cand_id='${req.body.cand_id}';`;
            conn.query(query, candidate, (err, results) => {
                if(!err) {
                    
                    query = `UPDATE loginCredential SET password=${req.body.password} WHERE username='${req.body.cand_id}';`
                    conn.query(query, (err, results) => {
                        if(!err) {
                            return res.redirect(`/${userType}/dashboard?id=${req.body.cand_id}`);
                        } console.log(err);
                    })
                } console.log(err);
            });
        } else {console.log('now', req.body);
            let company = {}
            let login = {}

            Object.keys(req.body).forEach(key => {
                if(key === 'hrName' || key === 'password')
                    login[key] = req.body[key];
                else 
                    company[key] = req.body[key];
            });
            
            let query = `UPDATE company SET ? WHERE comp_id='${company.comp_id}'`;
            conn.query(query, company, (err, results) => {
                if(!err) console.log('updation successful');
                else console.log(err);

                query = `UPDATE recuireters SET hrName='${login.hrName}'`;
                conn.query(query, login, (err, results) => {
                    if(!err) {
                        console.log('updation successful');
                        return res.redirect(`/${userType}/dashboard?id=${req.query.id}`);
                    }
                    console.log(err);
                });
            });
        }
    });

app.route('/recruiter/newJob')
    .get((req, res) => {
        const { id: rec_id } = req.query;

        const query = `SELECT * FROM recuireters R, company C WHERE R.comp_id = C.comp_id AND R.rec_id='${rec_id}';`;
        conn.query(query, (err, results) => {
            if(!err) {
                const result = results[0] ? results[0] : {branches: ""};

                res.render('templates/newJob', { job: {locations: result.branches.split(';')}, company: {comp_id: result.comp_id, companyName: result.companyName}, id: rec_id})
            } else console.log(err);
        });
    })
    .post((req, res) => {
        let job = req.body;
        
        let query = `SELECT j_id FROM jobs ORDER BY CAST(SUBSTR(j_id,2) AS UNSIGNED) DESC LIMIT 1;`;
        conn.query(query, (err, results) => {
            if(err) console.log(err);
            
            let { j_id } = results[0];
            
            if(!j_id) j_id = "J1";
            else j_id = j_id.substr(0, 1) + (parseInt(j_id.substr(1)) + 1).toString();

            query = `INSERT INTO jobs VALUES('${j_id}', '${job.rec_id}', '${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}', '${job.qualificationNeeded}', '${job.description}', '${job.location}', '${job.appDeadline}', '${job.vacancies}', '${job.comp_id}');`;

            conn.query(query, (err, results) => {
                if(!err) {
                    return res.redirect('/recuirter/allJobs?id=' + job.rec_id);
                } else {
                    console.log(err);
                }
            })
        });
    })

app.post('/candidate/applyJob', (req, res) => {
    const { j_id, cand_id, rec_id } = req.query;

    let query = `SELECT app_no FROM applications ORDER BY app_no DESC LIMIT 1;`;
    conn.query(query, (err, results) => {
        if(err) return console.log(err);
        let { app_no } = results[0] ? results[0] : {};

        if(!app_no) app_no = "Appl1";
        else app_no = app_no.substr(0, 4) + (parseInt(app_no.substr(4)) + 1).toString();

        query = `INSERT INTO applications SET ?, app_no = '${app_no}', appliedOn='${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}',selection = false`;
        conn.query(query, req.query, (err, results) => {
            if(!err) {
                res.redirect('/candidate/allApplications?id='+cand_id);
            } console.log(err);
        });
    })
    
});

app.route('/:userType/allApplications')
    .get((req, res) => {
        const { userType } = req.params;
        const { id: cand_id } = req.query;

        if(userType === 'candidate') {
            let query = `SELECT * FROM applications A, company C, jobs J
            WHERE A.j_id = J.j_id AND J.comp_id = C.comp_id AND A.cand_id='${cand_id}';`;
            conn.query(query, (err, results) => {
                if(err) return console.log(err);
                let applications = JSON.parse(JSON.stringify(results));
                console.log(applications);

                res.render('templates/allApplications', {userType, cand_id,applications})
            })

        } else {
            const { userType } = req.params;
            const { id: rec_id } = req.query;

            let query = `SELECT * FROM applications A, candidates C, jobs J
            WHERE A.rec_id = J.rec_id AND A.j_id = J.j_id AND C.cand_id = A.cand_id AND A.rec_id='${rec_id}';`

            conn.query(query, (err, results) => {
                if(err) return console.log(err);

                let applications = results ? results : [];
                console.log(applications);

                res.render('templates/allApplications', {userType, id: rec_id, applications});
            });
        }
    })
    .post()

app.post('/candidate/select', (req, res) => {
    // console.log(req.body);
    // const { selection } = req.body;
    const { cand_id, j_id, selection } = req.query;

    let query = `UPDATE applications SET selection = ${selection} WHERE cand_id='${cand_id}' AND j_id='${j_id}';`;
    conn.query(query, req.query, (err,results) => {
        if(err) {return res.json({error: true, msg: err}); console.log(err);}

        res.json({error: false, status: 'completed'});
    })  
});

app.listen(3000, () => console.log('Server is running on PORT 3000'));