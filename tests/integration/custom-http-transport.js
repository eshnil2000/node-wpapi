'use strict';
var chai = require( 'chai' );
var sinon = require( 'sinon' );
chai.use( require( 'sinon-chai' ) );
// Variable to use as our "success token" in promise assertions
var SUCCESS = 'success';
// Chai-as-promised and the `expect( prom ).to.eventually.equal( SUCCESS ) is
// used to ensure that the assertions running within the promise chains are
// actually run.
chai.use( require( 'chai-as-promised' ) );
var expect = chai.expect;

/*jshint -W079 */// Suppress warning about redefiniton of `Promise`
var Promise = require( 'es6-promise' ).Promise;

var WPAPI = require( '../../' );

var httpTransport = require( '../../lib/http-transport' );

var credentials = require( './helpers/constants' ).credentials;

describe( 'integration: custom HTTP transport methods', function() {
	var wp;
	var id;
	var cache;
	var cachingGet;

	beforeEach(function() {
		cache = {};
		cachingGet = sinon.spy(function( wpreq, cb ) {
			var result = cache[ wpreq ];
			// If a cache hit is found, return it via the same callback/promise
			// signature as the default transport method
			if ( result ) {
				if ( cb && typeof cb === 'function' ) {
					cb( null, result );
				}
				return Promise.resolve( result );
			}

			// Delegate to default transport if no cached data was found
			return WPAPI.transport.get( wpreq, cb ).then(function( result ) {
				cache[ wpreq ] = result;
				return result;
			});
		});

		return WPAPI.site( 'http://wpapi.loc/wp-json' )
			.posts()
			.perPage( 1 )
			.then(function( posts ) {
				id = posts[ 0 ].id;

				// Set up our spy here so the request to get the ID isn't counted
				sinon.spy( httpTransport, 'get' );
			});
	});

	afterEach(function() {
		httpTransport.get.restore();
	});

	it( 'can be defined to e.g. use a cache when available', function() {
		var query1;
		var query2;

		wp = new WPAPI({
			endpoint: 'http://wpapi.loc/wp-json',
			transport: {
				get: cachingGet
			}
		}).auth( credentials );

		query1 = wp.posts().id( id );
		var prom = query1
			.get()
			.then(function( result ) {
				expect( result.id ).to.equal( id );
				expect( cachingGet.callCount ).to.equal( 1 );
				expect( httpTransport.get.callCount ).to.equal( 1 );
				expect( httpTransport.get ).to.have.been.calledWith( query1 );
				expect( result ).to.equal( cache[ 'http://wpapi.loc/wp-json/wp/v2/posts/' + id ] );
			})
			.then(function() {
				query2 = wp.posts().id( id );
				return query2.get();
			})
			.then(function( result ) {
				expect( cachingGet.callCount ).to.equal( 2 );
				expect( httpTransport.get.callCount ).to.equal( 1 );
				// sinon will try to use toString when comparing arguments in calledWith,
				// so we mess with that method to properly demonstrate the inequality
				query2.toString = function() {};
				expect( httpTransport.get ).not.to.have.been.calledWith( query2 );
				expect( result ).to.equal( cache[ 'http://wpapi.loc/wp-json/wp/v2/posts/' + id ] );
				return SUCCESS;
			});

		return expect( prom ).to.eventually.equal( SUCCESS );
	});

});
