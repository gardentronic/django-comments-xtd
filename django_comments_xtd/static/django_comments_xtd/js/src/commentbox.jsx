import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import * as lib from './lib.js';
import django from 'django';

import {Comment} from './comment.jsx';
import {CommentForm} from './commentform.jsx';


export class CommentBox extends React.Component {
  constructor(props) {
    super(props);
    lib.jquery_ajax_setup('csrftoken');
    this.state = {
      show_form: false,
      previewing: false,
      preview: {name: '', email: '', url: '', comment: ''},
      tree: [], cids: [], newcids: [], counter: this.props.comment_count
    };
    this.handle_comment_created = this.handle_comment_created.bind(this);
    this.handle_preview = this.handle_preview.bind(this);
    this.handle_update = this.handle_update.bind(this);
    this.handleBtnClick = this.handleBtnClick.bind(this);

  }

  handle_comment_created() {
    this.load_comments();
  }
  
  handle_preview(name, email, url, comment) {
    this.setState({
      preview: {name: name, email: email, url: url, comment: comment},
      previewing: true
    });
  }

  handle_update(event) {
    event.preventDefault();
    this.load_comments();
  }

  reset_preview() {
    this.setState({
      preview: {name: '', email: '', url: '', comment: ''},
      previewing: false
    });
  }

  render_comment_counter() {
    if (this.state.counter > 0) {
      var fmts = django.ngettext("%s comment.", "%s comments.",
                                 this.state.cids.length);
      var text = django.interpolate(fmts, [this.state.cids.length]);
      return <h5 className="text-center">{text}</h5>;
    } else
      return "";
  }

  render_comment_form() {
    if(this.props.allow_comments) {
      return (
        <CommentForm {...this.props}
                     on_comment_created={this.handle_comment_created} />
      );
    } else {
      return (
        <h5>Comments are disabled for this article.</h5>
      );
    }
  }

  render_update_alert() {
    var diff = this.state.counter - this.state.cids.length;
    if (diff > 0) {
      var fmts = django.ngettext("There is %s new comment.",
                                 "There are %s new comments.", diff);
      var message = django.interpolate(fmts, [diff]);
      return (
        <div className="alert alert-info d-flex align-items-center">
          <p className="mr-auto">{message}</p>
          <button type="button" className="btn btn-secondary btn-xs"
                  onClick={this.handle_update}>update</button>
        </div>
      );
    } else
      return "";
  }

  create_tree(data) {
    var tree = new Array();
    var order = new Array();
    var comments = {};
    var children = {};
    var incids = [], curcids = [], newcids = [];

    function get_children(cid) {
      return children[cid].map(function(index) {
        if(comments[index].children == undefined) {
          comments[index].children = get_children(index);
        }
        return comments[index];
      });
    };
    
    for (let item of data) {
      incids.push(item.id);
      comments[item.id] = item;
      if (item.level == 0) {
        order.push(item.id);
      }
      children[item.id] = [];
      if (item.parent_id!==item.id) {
        children[item.parent_id].push(item.id);
      }
    }
    for (let id of order) {
      comments[id].children = get_children(id);
      tree.push(comments[id]);
    }

    // Update attributes curcids and newcids.
    if (incids.length) {
      if (this.state.cids.length) {
        for (let id of incids) {
          if (this.state.cids.indexOf(id) == -1)
            newcids.push(id);
          curcids.push(id);
        }
      } else {
        curcids = incids;
        newcids = [];
      }
    }

    this.setState({tree:tree,
                   cids: curcids,
                   newcids: newcids,
                   counter: curcids.length});
  }

  load_comments() {
    $.ajax({
      url: this.props.list_url,
      dataType: 'json',
      cache: false,
      success: function(data) {
        // Set here a cookie with the last time comments have been retrieved.
        // I'll use it to add a label 'new' to every new comment received
        // after the timestamp stored in the cookie.
        this.create_tree(data);
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(this.props.list_url, status, err.toString());
      }.bind(this)
    });
  }

  load_count() {
    $.ajax({
      url: this.props.count_url,
      dataType: 'json',
      cache: false,
      success: function(data) {
        this.setState({counter: data.count});
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(this.props.count_url, status, err.toString());
      }.bind(this)
    });
  }
  
  componentDidMount() {
    this.load_comments();
    if(this.props.polling_interval)
      setInterval(this.load_count.bind(this), this.props.polling_interval);
  }

  handleBtnClick(event) {
    this.setState(prevState => ({
        show_form : !prevState.show_form
    }));
  }

    renderLoginMsg() {
      return (<div className="text-muted mb-4 login-msg"><em>Login to post a comment.</em></div>)
  }

  render() {
    var settings = this.props;
    var update_alert = this.render_update_alert();
    const {is_authenticated} = this.props;
    var comment_form = is_authenticated && this.render_comment_form();
    const login_msg = !is_authenticated && this.renderLoginMsg();
    const {show_form} = this.state;
    var nodes = this.state.tree.map(function(item) {
      return (
        <Comment key={item.id}
                 data={item}
                 settings={settings}
                 newcids={this.state.newcids}
                 on_comment_created={this.handle_comment_created} />
      );
    }.bind(this));
  return (
      <>
          <div className="segment">
              <button className="btn btn-primary pull-right" id="comment-btn"
                      onClick={(event) => this.handleBtnClick(event)}>COMMENT
              </button>
              <h3>COMMENTS</h3>
          </div>
          {update_alert}
          <div className="comment-tree col-12 mx-auto mt-4">
              { login_msg }
              <div className="media-list">
                  {nodes}
              </div>
              { show_form && comment_form }
          </div>
      </>);
  }
}