---
layout: post
title: "Refactoring: Separating Concerns from the Controller"
date: 2015-09-05
categories: blog
comments: true
tags:
  - programming
  - php
  - laravel
  - mvc
  - refactoring
---

One of the hardest things for a beginner programmer to do is take the concepts that they have learned and apply them to real-world applications. From time to time, it's necessary to take a step back from the code and really think about what you are doing.

This is how I realized that cramming a bunch of logic into a controller isn't any different from writing procedural spaghetti monsters. All of the lessons I watched and all of the articles I read up to that point had helped me recognize that this was a bad thing, which is great, but they didn't really tell me how to fix it.

So here I was with a problem that I didn't know how to fix it. My Controller looked something like this:

{% highlight php startinline=true %}
namespace App\Http\Controllers;

use App\User;
use Dropbox\Client;
use Illuminate\Support\Facades\Auth;

class HomeController extends Controller
{
    public function index($songs = null)
    {
        if (Auth::check()) {

            $user = User::where('id', Auth::id())->first();

            if (!is_null($user->dropbox_token)) {

                $dropboxClient = new Client($user->dropbox_token, 'App/1.0');
                $dropboxFiles = $dropboxClient->getDelta()['entries'];
                $mimeTypes = ['audio/mpeg'];

                foreach ($dropboxFiles as $file) {
                    if (array_key_exists('mime_type', $file[1]) && in_array($file[1]['mime_type'], $mimeTypes)) {
                        $songs[] = $file;
                    }
                }
            }
        }

        return view('home')->with('songs', $songs);
    }
}
{% endhighlight %}

It functioned, but it was a mess. I had no clue where to even begin to clean it up. I immediately defaulted to my usual learning method of watching screencasts of other people building applications.

After several hours, I knew that this approach just wasn't working for me. So I did something that I had seldom done before &ndash; I [reached out for help](https://www.reddit.com/r/PHPhelp/comments/3hh8ll/separating_concerns_from_controller/){:target="_blank"}. To my surprise, the incredibly knowledgeable [Paul Jones](http://paul-m-jones.com/){:target="_blank"} replied.

The conversation I had with Paul, and the others in that thread, may have been the single most informative programming learning environment that I have ever had the pleasure of being a part of, and it was made possible by simply asking a question.

The first piece of advice I had been given was to take everything within the first if statement and put it in its own class. Doing that will give you something that looks like this:

{% highlight php startinline=true %}
namespace App\Dropbox;

use App\User;
use Dropbox\Client;
use Illuminate\Support\Facades\Auth;

class DropboxRepository
{
    private $user;

    public function __construct()
    {
        $this->user = User::where('id', Auth::id())->first();
    }

    public function getAllSongs()
    {
        $dropboxClient = new Client($this->user['dropbox_token'], 'App/1.0');
        $dropboxFiles = $dropboxClient->getDelta()['entries'];
        $mimeTypes = ['audio/mpeg'];

        foreach ($dropboxFiles as $file) {
            if (array_key_exists('mime_type', $file[1]) && in_array($file[1]['mime_type'], $mimeTypes)) {
                $songs[] = $file;
            }
        }

        return $songs;
    }
}
{% endhighlight %}

{% highlight php startinline=true %}
namespace App\Http\Controllers;

use Exception;
use App\Dropbox\DropboxRepository;

class HomeController extends Controller
{
    public function index($songs = null)
    {
       try {
            $dropboxRepository = new DropboxRepository();
            $songs = $dropboxRepository->getAllSongs();
        } catch (Exception $e) {
            // swallow exception
        }
        return view('home')->with('songs', $songs);
    }
}
{% endhighlight %}

The predominant reason to move this logic to its own class is to keep in adherence with the Model-View-Controller architectural pattern. In this pattern, the Controller should only be responsible for acting as an intermediary between the View and the Model.

When interacting with the Model, the Controller should request data from and pass data to what is known as a “Service Layer.” Essentially, a Service Layer serves as an intermediary between the Controller and the Model, often times its purpose is to separate domain-specific logic from the Model. Upon receiving a request from the Controller, the Service Layer is responsible for returning domain-level data back to the Controller. The Controller then passes this information along to the View. It's important to distinguish that in this case, "domain-level data", also known as "domain logic", can be defined as any code that is specific to the application that you are building.

As you can see by my namespace, I made a Service Layer called "Dropbox" (nothing more than a folder) which contains my DropboxRepository file. Within the DropboxRepository class, we have a private property named user which reflects all of the information in the database row for the user. We will frequently be using this property throughout the class since it holds the user's Dropbox access token, which is needed to complete actions on behalf of the user.

There's also a public method, getAllSongs, which retrieves all of the audio files from the user's Dropbox account. To do this, a new Dropbox client is instantiated (with the user's Dropbox access token) and all of the files are pushed to an array named dropboxFiles. We then go through each file and check its mime type to see if it is an mp3 file. If it is, it gets added to a new array named songs. At the very end, we return the songs array. A try/catch block is needed in the Controller because the Dropbox client will throw an exception if the user's access token is null.

This is a good first step, but DropboxRepository can be refactored even more:

{% highlight php startinline=true %}
namespace App\ServiceLayer\Dropbox;

use Dropbox\Client;
use Illuminate\Contracts\Auth\Guard as Auth;

class DropboxRepository
{
    private $user;

    public function __construct(Auth $auth)
    {
        $this->user = $auth->user();
    }

    public function getAllSongs()
    {
        $dropboxClient = new Client($this->user['dropbox_token'], 'App/1.0');
        $dropboxFiles = $dropboxClient->getDelta()['entries'];
        $mimeTypes = ['audio/mpeg'];

        foreach ($dropboxFiles as $file) {
            if (array_key_exists('mime_type', $file[1]) && in_array($file[1]['mime_type'], $mimeTypes)) {
                $songs[] = $file;
            }
        }

        return $songs;
    }
}
{% endhighlight %}

You may have noticed the namespace changed. I decided to create a "ServiceLayer" folder and I put the "Dropbox" folder inside of it. Although this is just a minor directory structure modification, it is a far superior naming convention. Later down the road I might have more services, but they won't all necessarily be Dropbox-related.

In addition, the constructor got a nifty new parameter. The process of type-hinting an instance of a class is called "dependency injection." When done via the constructor, it's simply known as "constructor injection." Using dependency injection here is very useful because it decouples the DropboxRepository class from Laravel's static function calls (aka facades). One of the many benefits of this is it makes it a lot easier to test.

It's worth mentioning that I tried to decouple from the Laravel framework itself by using the Guard Contract instead of a concrete class implementation for authentication. Nevertheless, I'm going to stop there since decoupling and testing are broad topics that need their own dedicated blog post. 

One last change to note: [/u/tonysmessias](https://www.reddit.com/user/tonysmessias){:target="_blank"} pointed out that the user method already reflects the entire user model, so there is no point in executing a database query for information that we already possess.

Because we are now injecting our dependencies, HomeController needs to be refactored as well:

{% highlight php startinline=true %}
namespace App\Http\Controllers;

use Exception;
use App\ServiceLayer\Dropbox\DropboxRepository;

class HomeController extends Controller
{
    private $dropboxRepository;

    public function __construct(DropboxRepository $dropboxRepository)
    {
        $this->dropboxRepository = $dropboxRepository;
    }

    public function index($songs = null)
    {
        try {
            $songs = $this->dropboxRepository->getAllSongs();
        } catch (Exception $e) {
            // swallow exception
        }
        return view('home')->with('songs', $songs);
    }
}
{% endhighlight %}

Laravel has a Service/Inversion of Control (IoC) container which will resolve dependencies for you; however, it only does this automatically for built-in Laravel classes (like Controllers, Commands, etc). Since we moved all of our domain logic from HomeController to DropboxRepository, dependency injection is no longer done behind the scenes for us. In order to make Laravel resolve dependencies automatically again, we need to use traditional constructor injection inside the HomeController for DropboxRepository.

Now that our dependencies are resolved, we can make a few more improvements to DropboxRepository:

{% highlight php startinline=true %}
namespace App\ServiceLayer\Dropbox;

use Exception;
use Dropbox\Client;
use InvalidArgumentException;
use Illuminate\Contracts\Auth\Guard as Auth;

class DropboxRepository
{
    private $accessToken;

    public function __construct(Auth $auth)
    {
        $this->accessToken = $auth->user()['dropbox_token'];
    }

    public function retrieveAllAudioFiles()
    {
        try {
            $songs = $this->getAllFiles()->filter(function ($file) {
                $mimeTypes = ['audio/mpeg'];
                return (array_key_exists('mime_type', $file[1]) && in_array($file[1]['mime_type'], $mimeTypes));
            });
            return ($songs->isEmpty()) ? null : $songs;
        } catch (Exception $e) {
            return null;
        }
    }

    private function getAllFiles()
    {
        try {
            $dropboxClient = new Client($this->accessToken, 'App/1.0');
            return collect($dropboxClient->getDelta()['entries']);
        } catch (InvalidArgumentException $e) {
            throw new Exception("User has not authenticated with Dropbox yet");
        }
    }
}
{% endhighlight %}

The first thing I did was replace the user property with the accessToken property. Since DropboxRepository is only responsible for interacting with Dropbox, the only information it needs to know about the user is their access token. All of the other information about the user is *completely* irrelevant and will never be used.

The next thing I did was break getAllSongs into two separate methods. This step is not mandatory, but I've typically found that it's useful to break large monolithic methods into smaller micro-methods for reusability purposes. Say, for instance, the spec of my app changes and I want to incorporate video files. Now I would easily be able to create a new method named retrieveAllVideoFiles and save myself from duplicating code by just calling getAllFiles from within it.

Anyway, it's also important to note that I'm returning a collection of files instead of an array of files (Laravel provides a helper function named collect which converts arrays to collections for you, collect is not native to PHP). While changing an array to a collection certainly isn't required, it gives us the added functionality of method chaining, which, as demonstrated here, is extremely useful for refactoring loops and conditionals.

In addition, I abstracted even more logic from the Controller by including the try/catch blocks inside the methods themselves as opposed to when they were being called.

Here's the final version of HomeController, without the try/catch block:

{% highlight php startinline=true %}
namespace App\Http\Controllers;

use App\ServiceLayer\Dropbox\DropboxRepository;

class HomeController extends Controller
{
    private $dropboxRepository;

    public function __construct(DropboxRepository $dropboxRepository)
    {
        $this->dropboxRepository = $dropboxRepository;
    }

    public function index()
    {
        $songs = $this->dropboxRepository->retrieveAllAudioFiles();
        return view('home')->with('songs', $songs);
    }
}
{% endhighlight %}

Remember what it used to look like? ;)

There's still *even more* that can be done &ndash; refactoring is a continuous process &ndash; but these are huge steps in the right direction.

So, I suppose there are a couple of morals to go along with this post:

1. Always try to improve. Don't get too comfortable writing code in a specific manner. Strive to learn as much as you can, it will improve the quality of your code and make you a better developer.
2. Practice. Practice. Practice. Do not get in a state of [tutorial paralysis](http://blog.samanthageitz.com/dont-get-caught-in-tutorial-paralysis/){:target="_blank"}. Get out there and write some code.
3. Ask questions. Lots of them. Don't be afraid to reach out for help. There are a lot of awesome people in the PHP community that are happy to share their knowledge with you.