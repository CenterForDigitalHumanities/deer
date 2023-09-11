# Contribute to DEER

## ❤️ Thank You
Thank you for considering a contribution!  The `main` branch is protected and you cannot push to it.  Please make a new branch, and when you are a finished open a pull request targeting the `main` branch.  The pull request will be reviewed and we will get back to you.

## Ready to Install It And Run It!

***RUN THE APP IN A WEB SERVER CONTAINER***

If you want to contribute, it is imortant you are able to deploy the code and run locally.  To do so, it is best you use some kind of web server such as a [Docker Container](https://docs.docker.com/get-started/) or [Tomcat Web Server](https://tomcat.apache.org/).  You can use any web server container you prefer.  

You want a web server because a core functionality of the DEER framework is to ask the internet for resources by their URI, like https://store.rerum.io/v1/id/11111.  Running DEER through your filesystem as opposed to a web server will cause errors when trying to pull in resources from the web.  Feel free to try.

## Ready to Code!

You may contribute to the code directly through its repository or by making a fork in your own repository space. Please make a new branch, and when you are a finished open a pull request targeting the `main` branch.  The pull request will be reviewed.

Make sure Git is installed on your machine.  For download and installation instruction, [head to the Git guide](https://git-scm.com/downloads).  Note this can also be achieved by install [GitHub for Desktop](https://desktop.github.com/).  

The following is a git shell example for installing the app on your local machine.

```
cd /web_container/
git clone https://github.com/CenterForDigitalHumanities/deer.git deer
```

That's all you need!  Now start up your web server.  If you used the example above access the viewer at http://localhost/deer.  


## 🎉 Ready to code!

Awesome!  Now, make a new branch through the GitHub Interface or through your shell.  Make sure you 'checkout' that branch.

```
cd /web_container/deer
git checkout my_new_branch
```

Now you can make code changes and see them in real time.  You can make HTML pages in `/web_container/deer` and fill those pages with DEER forms and views.  Test your changes and see what they look like!  When you are finished with the commits to your new branch, open a Pull Request that targets the `main` branch at [https://github.com/CenterForDigitalHumanities/deer/tree/main/] (https://github.com/CenterForDigitalHumanities/deer/tree/main/).